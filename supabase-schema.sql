-- ChefOS Supabase Schema
-- Run this in your Supabase SQL editor

-- 1. PROFILES
create table profiles (
  id uuid primary key references auth.users(id),
  display_name text,
  email text,
  role text default 'user',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- 2. HOMES
create table homes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id),
  name text not null,
  location text,
  notes text,
  kitchen_equipment text,
  preferences text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  archived_at timestamp
);

-- 3. HOME MEMBERS
create table home_members (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id),
  user_id uuid references profiles(id),
  role text check (role in ('admin','staff','viewer')) default 'staff',
  can_edit_pantry boolean default false,
  can_add_shopping_items boolean default true,
  can_log_meals boolean default false,
  invited_by uuid references profiles(id),
  created_at timestamp default now(),
  removed_at timestamp
);

-- 4. PANTRY ITEMS
create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id),
  created_by uuid references profiles(id),
  name text not null,
  category text,
  quantity numeric default 0,
  unit text,
  minimum_quantity numeric default 0,
  preferred_brand text,
  storage_location text,
  notes text,
  barcode text,
  status text default 'OK',
  created_at timestamp default now(),
  updated_at timestamp default now(),
  archived_at timestamp
);

-- 5. SHOPPING ITEMS
create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id),
  pantry_item_id uuid references pantry_items(id),
  name text not null,
  quantity_needed text,
  category text,
  store text,
  priority text check (priority in ('Normal','Important','Urgent')) default 'Normal',
  notes text,
  added_by uuid references profiles(id),
  assigned_to uuid references profiles(id),
  status text check (status in ('Open','Purchased','Archived')) default 'Open',
  created_at timestamp default now(),
  completed_at timestamp,
  archived_at timestamp
);

-- 6. DISH LIBRARY
create table dish_library (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id),
  name text not null,
  category text,
  ingredients text,
  prep_time text,
  storage_instructions text,
  reheating_instructions text,
  tags text[],
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  archived_at timestamp
);

-- 7. PREPARED MEALS
create table prepared_meals (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id),
  dish_id uuid references dish_library(id),
  created_by uuid references profiles(id),
  name text not null,
  prepared_date date,
  expiry_date date,
  portions integer,
  storage_location text,
  reheating_instructions text,
  notes text,
  client_feedback text,
  status text default 'Fresh',
  created_at timestamp default now(),
  updated_at timestamp default now(),
  archived_at timestamp
);

-- 8. WEEKLY MENUS
create table weekly_menus (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id),
  created_by uuid references profiles(id),
  week_start date not null,
  status text check (status in ('draft','confirmed')) default 'draft',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- 9. MENU ITEMS (dishes per day within a weekly menu)
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid references weekly_menus(id),
  dish_id uuid references dish_library(id),
  day_of_week integer check (day_of_week between 0 and 6), -- 0=Monday
  category text,
  dish_name text not null,
  portions integer default 2,
  notes text,
  created_at timestamp default now()
);

-- 10. PRODUCT CATALOG (per-user barcode memory)
create table product_catalog (
  id uuid primary key default gen_random_uuid(),
  barcode text not null,
  product_name text not null,
  brand text,
  default_quantity numeric,
  default_unit text,
  default_category text,
  notes text,
  created_by uuid references profiles(id) not null,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (barcode, created_by)
);

-- 11. BARCODE SCANS
create table barcode_scans (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id),
  user_id uuid references profiles(id),
  barcode text,
  product_name text,
  quantity numeric,
  unit text,
  storage_location text,
  scan_mode text check (scan_mode in ('single','batch','photo')) default 'single',
  created_at timestamp default now()
);

-- ──────────────────────────────────────────────────────────────
-- PROFILE AUTO-CREATION TRIGGER
-- Runs after every new auth.users insert — no code change needed.
-- ──────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
alter table profiles        enable row level security;
alter table homes           enable row level security;
alter table home_members    enable row level security;
alter table pantry_items    enable row level security;
alter table shopping_items  enable row level security;
alter table dish_library    enable row level security;
alter table prepared_meals  enable row level security;
alter table weekly_menus    enable row level security;
alter table menu_items      enable row level security;
alter table product_catalog enable row level security;
alter table barcode_scans   enable row level security;

-- Profiles (id = auth.users.id; not user_id)
create policy "Users can view own profile" on profiles
  for select to authenticated using (auth.uid() = id);
create policy "Users can insert own profile" on profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Helper: is the requesting user a member of a given home?
create or replace function is_home_member(p_home_id uuid)
returns boolean as $$
  select exists (
    select 1 from home_members
    where home_id = p_home_id
      and user_id = auth.uid()
      and removed_at is null
  ) or exists (
    select 1 from homes
    where id = p_home_id and owner_id = auth.uid()
  );
$$ language sql security definer stable;

-- Homes
create policy "Home owners and members can view" on homes
  for select using (is_home_member(id));
create policy "Owners can insert homes" on homes
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "Owners can update homes" on homes
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create policy "Owners can delete homes" on homes
  for delete to authenticated using (auth.uid() = owner_id);

-- Home members
create policy "View home members" on home_members
  for select using (is_home_member(home_id));
create policy "Owners manage members" on home_members
  for all using (
    exists (select 1 from homes where id = home_id and owner_id = auth.uid())
  );

-- Pantry items
create policy "Members view pantry" on pantry_items
  for select using (is_home_member(home_id));
create policy "Pantry editors can write" on pantry_items
  for insert with check (
    exists (
      select 1 from home_members
      where home_id = pantry_items.home_id
        and user_id = auth.uid()
        and can_edit_pantry = true
        and removed_at is null
    ) or exists (select 1 from homes where id = home_id and owner_id = auth.uid())
  );
create policy "Pantry editors can update" on pantry_items
  for update using (
    exists (
      select 1 from home_members
      where home_id = pantry_items.home_id
        and user_id = auth.uid()
        and can_edit_pantry = true
        and removed_at is null
    ) or exists (select 1 from homes where id = home_id and owner_id = auth.uid())
  );

-- Shopping items
create policy "Members view shopping" on shopping_items
  for select using (is_home_member(home_id));
create policy "Members add shopping items" on shopping_items
  for insert with check (
    exists (
      select 1 from home_members
      where home_id = shopping_items.home_id
        and user_id = auth.uid()
        and can_add_shopping_items = true
        and removed_at is null
    ) or exists (select 1 from homes where id = home_id and owner_id = auth.uid())
  );
create policy "Members update own shopping items" on shopping_items
  for update using (is_home_member(home_id));

-- Dish library (shared across all authenticated users)
create policy "Authenticated users view dishes" on dish_library
  for select using (auth.uid() is not null);
create policy "Authenticated users add dishes" on dish_library
  for insert with check (auth.uid() = created_by);
create policy "Dish creators update their dishes" on dish_library
  for update using (auth.uid() = created_by);

-- Prepared meals
create policy "Members view meals" on prepared_meals
  for select using (is_home_member(home_id));
create policy "Meal loggers can insert" on prepared_meals
  for insert with check (
    exists (
      select 1 from home_members
      where home_id = prepared_meals.home_id
        and user_id = auth.uid()
        and can_log_meals = true
        and removed_at is null
    ) or exists (select 1 from homes where id = home_id and owner_id = auth.uid())
  );
create policy "Meal loggers can update" on prepared_meals
  for update using (is_home_member(home_id));

-- Weekly menus & menu items
create policy "Members view weekly menus" on weekly_menus
  for select using (is_home_member(home_id));
create policy "Members create weekly menus" on weekly_menus
  for insert with check (is_home_member(home_id));
create policy "Members update weekly menus" on weekly_menus
  for update using (is_home_member(home_id));

create policy "View menu items" on menu_items
  for select using (
    exists (
      select 1 from weekly_menus wm
      where wm.id = menu_items.menu_id and is_home_member(wm.home_id)
    )
  );
create policy "Insert menu items" on menu_items
  for insert with check (
    exists (
      select 1 from weekly_menus wm
      where wm.id = menu_items.menu_id and is_home_member(wm.home_id)
    )
  );
create policy "Update menu items" on menu_items
  for update using (
    exists (
      select 1 from weekly_menus wm
      where wm.id = menu_items.menu_id and is_home_member(wm.home_id)
    )
  );
create policy "Delete menu items" on menu_items
  for delete using (
    exists (
      select 1 from weekly_menus wm
      where wm.id = menu_items.menu_id and is_home_member(wm.home_id)
    )
  );

-- Product catalog (private per user)
create policy "Users view own catalog" on product_catalog
  for select to authenticated using (auth.uid() = created_by);
create policy "Users insert own catalog" on product_catalog
  for insert to authenticated with check (auth.uid() = created_by);
create policy "Users update own catalog" on product_catalog
  for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);
create policy "Users delete own catalog" on product_catalog
  for delete to authenticated using (auth.uid() = created_by);

-- Barcode scans
create policy "Users view own scans" on barcode_scans
  for select using (user_id = auth.uid());
create policy "Users insert own scans" on barcode_scans
  for insert with check (auth.uid() = user_id);

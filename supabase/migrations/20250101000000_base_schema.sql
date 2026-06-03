-- ChefOS base schema (fresh database only)
-- Creates tables, triggers, RLS, and policies. Do not re-run on an existing production database.

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
  role text check (role in ('admin','manager','staff','viewer')) default 'staff',
  can_edit_pantry boolean default false,
  can_add_shopping_items boolean default true,
  can_log_meals boolean default false,
  can_manage_team boolean default false,
  can_edit_menu boolean default false,
  can_archive_residence boolean default false,
  can_use_scan boolean default false,
  can_manage_dish_repertoire boolean default false,
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

-- 6. DISH REPERTOIRE (dish_library)
create table dish_library (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id),
  name text not null,
  category text,
  description text,
  meal_category text,
  cuisine_style text,
  dietary_tags text[] default '{}',
  ingredients text,
  instructions text,
  prep_time text,
  storage_instructions text,
  reheating_instructions text,
  tags text[],
  notes text,
  default_servings integer default 4,
  is_active boolean default true,
  residence_notes jsonb default '{}',
  created_at timestamp default now(),
  updated_at timestamp default now(),
  archived_at timestamp
);

create table dish_ingredients (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references dish_library(id) on delete cascade,
  sort_order integer default 0,
  name text not null,
  quantity numeric default 1,
  unit text,
  category text,
  notes text,
  created_at timestamp default now()
);

create index dish_ingredients_dish_id_idx on dish_ingredients(dish_id);

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

-- 9. MENU ITEMS
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid references weekly_menus(id),
  dish_id uuid references dish_library(id),
  day_of_week integer check (day_of_week between 0 and 6),
  category text,
  dish_name text not null,
  portions integer default 2,
  notes text,
  created_at timestamp default now()
);

-- 10. PRODUCT CATALOG
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

-- Profile auto-creation trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS helpers (security definer — no policy recursion)
create or replace function public.is_home_owner(p_home_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.homes
    where id = p_home_id and owner_id = auth.uid()
  );
$$;

create or replace function public.is_home_member(p_home_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_home_owner(p_home_id)
  or exists (
    select 1 from public.home_members
    where home_id = p_home_id
      and user_id = auth.uid()
      and removed_at is null
  );
$$;

alter table profiles enable row level security;
alter table homes enable row level security;
alter table home_members enable row level security;
alter table pantry_items enable row level security;
alter table shopping_items enable row level security;
alter table dish_library enable row level security;
alter table dish_ingredients enable row level security;
alter table prepared_meals enable row level security;
alter table weekly_menus enable row level security;
alter table menu_items enable row level security;
alter table product_catalog enable row level security;
alter table barcode_scans enable row level security;

-- Profiles
create policy "Users can view own profile" on profiles
  for select to authenticated using (auth.uid() = id);
create policy "Users can insert own profile" on profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Homes (direct checks — avoids homes ↔ home_members recursion)
create policy "Home owners and members can view" on homes
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.home_members hm
      where hm.home_id = homes.id
        and hm.user_id = auth.uid()
        and hm.removed_at is null
    )
  );
create policy "Owners can insert homes" on homes
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "Owners can update homes" on homes
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create policy "Owners can delete homes" on homes
  for delete to authenticated using (auth.uid() = owner_id);

-- Home members (no is_home_member in SELECT — avoids recursion)
create policy "View home members" on home_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_home_owner(home_id)
  );
create policy "Owners manage members" on home_members
  for all to authenticated
  using (public.is_home_owner(home_id))
  with check (public.is_home_owner(home_id));

-- Pantry (member-wide edit — matches app expectations)
create policy "Members view pantry" on pantry_items
  for select using (public.is_home_member(home_id));
create policy "Pantry editors can write" on pantry_items
  for insert with check (public.is_home_member(home_id));
create policy "Pantry editors can update" on pantry_items
  for update using (public.is_home_member(home_id));

-- Shopping
create policy "Members view shopping" on shopping_items
  for select using (public.is_home_member(home_id));
create policy "Members add shopping items" on shopping_items
  for insert with check (public.is_home_member(home_id));
create policy "Members update own shopping items" on shopping_items
  for update using (public.is_home_member(home_id));

-- Dish library
create policy "Authenticated users view dishes" on dish_library
  for select using (auth.uid() is not null);
create policy "Authenticated users add dishes" on dish_library
  for insert with check (auth.uid() = created_by);
create policy "Dish creators update their dishes" on dish_library
  for update using (auth.uid() = created_by);

create policy "View dish ingredients" on dish_ingredients
  for select to authenticated
  using (
    exists (
      select 1 from dish_library d
      where d.id = dish_ingredients.dish_id and d.archived_at is null
    )
  );
create policy "Manage own dish ingredients" on dish_ingredients
  for all to authenticated
  using (
    exists (
      select 1 from dish_library d
      where d.id = dish_ingredients.dish_id and d.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from dish_library d
      where d.id = dish_ingredients.dish_id and d.created_by = auth.uid()
    )
  );

-- Prepared meals
create policy "Members view meals" on prepared_meals
  for select using (public.is_home_member(home_id));
create policy "Meal loggers can insert" on prepared_meals
  for insert with check (public.is_home_member(home_id));
create policy "Meal loggers can update" on prepared_meals
  for update using (public.is_home_member(home_id));

-- Weekly menus
create policy "Members view weekly menus" on weekly_menus
  for select using (public.is_home_member(home_id));
create policy "Members create weekly menus" on weekly_menus
  for insert with check (public.is_home_member(home_id));
create policy "Members update weekly menus" on weekly_menus
  for update using (public.is_home_member(home_id));

create policy "View menu items" on menu_items
  for select using (
    exists (
      select 1 from weekly_menus wm
      where wm.id = menu_items.menu_id and public.is_home_member(wm.home_id)
    )
  );
create policy "Insert menu items" on menu_items
  for insert with check (
    exists (
      select 1 from weekly_menus wm
      where wm.id = menu_items.menu_id and public.is_home_member(wm.home_id)
    )
  );
create policy "Update menu items" on menu_items
  for update using (
    exists (
      select 1 from weekly_menus wm
      where wm.id = menu_items.menu_id and public.is_home_member(wm.home_id)
    )
  );
create policy "Delete menu items" on menu_items
  for delete using (
    exists (
      select 1 from weekly_menus wm
      where wm.id = menu_items.menu_id and public.is_home_member(wm.home_id)
    )
  );

-- Product catalog
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

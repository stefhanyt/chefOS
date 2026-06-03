-- Team roles: manager role + RLS aligned with home_members flags / roles
-- Requires: 202501010000051_home_members_permissions.sql

alter table public.home_members drop constraint if exists home_members_role_check;
alter table public.home_members add constraint home_members_role_check
  check (role in ('admin', 'manager', 'staff', 'viewer'));

create or replace function public.member_can_edit_pantry(p_home_id uuid)
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
      and can_edit_pantry = true
  );
$$;

create or replace function public.member_can_add_shopping(p_home_id uuid)
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
      and can_add_shopping_items = true
  );
$$;

create or replace function public.member_can_log_meals(p_home_id uuid)
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
      and can_log_meals = true
  );
$$;

create or replace function public.member_can_edit_menu(p_home_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_home_owner(p_home_id)
  or exists (
    select 1 from public.home_members hm
    where hm.home_id = p_home_id
      and hm.user_id = auth.uid()
      and hm.removed_at is null
      and (hm.can_edit_menu = true or hm.role in ('admin', 'manager'))
  );
$$;

create or replace function public.member_can_view_pantry(p_home_id uuid)
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
      and role in ('admin', 'manager', 'staff')
  );
$$;

create or replace function public.member_can_view_shopping(p_home_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.member_can_view_pantry(p_home_id);
$$;

create or replace function public.can_manage_team(p_home_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_home_owner(p_home_id)
  or exists (
    select 1 from public.home_members hm
    where hm.home_id = p_home_id
      and hm.user_id = auth.uid()
      and hm.removed_at is null
      and (hm.can_manage_team = true or hm.role = 'admin')
  );
$$;

create or replace function public.can_administer_home(p_home_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.can_manage_team(p_home_id);
$$;

-- Pantry
drop policy if exists "Members view pantry" on pantry_items;
drop policy if exists "Pantry editors can write" on pantry_items;
drop policy if exists "Pantry editors can update" on pantry_items;

create policy "Members view pantry" on pantry_items
  for select using (public.member_can_view_pantry(home_id));

create policy "Pantry editors can write" on pantry_items
  for insert with check (public.member_can_edit_pantry(home_id));

create policy "Pantry editors can update" on pantry_items
  for update using (public.member_can_edit_pantry(home_id));

-- Shopping
drop policy if exists "Members view shopping" on shopping_items;
drop policy if exists "Members add shopping items" on shopping_items;
drop policy if exists "Members update own shopping items" on shopping_items;

create policy "Members view shopping" on shopping_items
  for select using (public.member_can_view_shopping(home_id));

create policy "Members add shopping items" on shopping_items
  for insert with check (public.member_can_add_shopping(home_id));

create policy "Members update own shopping items" on shopping_items
  for update using (public.member_can_add_shopping(home_id));

-- Prepared meals
drop policy if exists "Members view meals" on prepared_meals;
drop policy if exists "Meal loggers can insert" on prepared_meals;
drop policy if exists "Meal loggers can update" on prepared_meals;

create policy "Members view meals" on prepared_meals
  for select using (public.is_home_member(home_id));

create policy "Meal loggers can insert" on prepared_meals
  for insert with check (public.member_can_log_meals(home_id));

create policy "Meal loggers can update" on prepared_meals
  for update using (public.member_can_log_meals(home_id));

-- Weekly menus & menu items
drop policy if exists "Members create weekly menus" on weekly_menus;
drop policy if exists "Members update weekly menus" on weekly_menus;
drop policy if exists "Insert menu items" on menu_items;
drop policy if exists "Update menu items" on menu_items;
drop policy if exists "Delete menu items" on menu_items;

create policy "Members create weekly menus" on weekly_menus
  for insert with check (public.member_can_edit_menu(home_id));

create policy "Members update weekly menus" on weekly_menus
  for update using (public.member_can_edit_menu(home_id));

create policy "Insert menu items" on menu_items
  for insert with check (
    exists (
      select 1 from public.weekly_menus wm
      where wm.id = menu_items.menu_id
        and public.member_can_edit_menu(wm.home_id)
    )
  );

create policy "Update menu items" on menu_items
  for update using (
    exists (
      select 1 from public.weekly_menus wm
      where wm.id = menu_items.menu_id
        and public.member_can_edit_menu(wm.home_id)
    )
  );

create policy "Delete menu items" on menu_items
  for delete using (
    exists (
      select 1 from public.weekly_menus wm
      where wm.id = menu_items.menu_id
        and public.member_can_edit_menu(wm.home_id)
    )
  );

-- Homes update (edit details, archive) + team management
drop policy if exists "Owners can update homes" on homes;
create policy "Owners and admins can update homes" on homes
  for update to authenticated
  using (public.can_administer_home(id))
  with check (public.can_administer_home(id));

drop policy if exists "Owners manage members" on home_members;
create policy "Owners and admins manage members" on home_members
  for all to authenticated
  using (public.can_manage_team(home_id))
  with check (public.can_manage_team(home_id));

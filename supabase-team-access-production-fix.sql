-- =============================================================================
-- ChefOS: Team access production fix (run once in Supabase SQL Editor)
--
-- When to use: production already has base schema but team migrations failed
-- partway, or columns like can_edit_pantry / can_manage_team are missing.
--
-- Equivalent incremental migrations (do NOT re-run both paths):
--   202501010000051_home_members_permissions.sql  → section 1
--   20250101000006_team_roles_rls.sql             → sections 2–4
--   20250101000007_team_invite_by_email.sql       → section 5
--
-- NOT included (run separately if needed):
--   20250101000008_product_polish.sql — private/team notes, residence_activity
--
-- Safe: idempotent, no DROP TABLE, RLS stays enabled on all tables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. home_members: add missing columns + backfill from role
-- -----------------------------------------------------------------------------

alter table public.home_members
  add column if not exists role text default 'staff';

alter table public.home_members
  add column if not exists invited_by uuid references public.profiles(id);

alter table public.home_members
  add column if not exists created_at timestamptz default now();

alter table public.home_members
  add column if not exists removed_at timestamptz;

alter table public.home_members
  add column if not exists can_edit_pantry boolean default false;

alter table public.home_members
  add column if not exists can_add_shopping_items boolean default true;

alter table public.home_members
  add column if not exists can_log_meals boolean default false;

alter table public.home_members
  add column if not exists can_manage_team boolean default false;

alter table public.home_members
  add column if not exists can_edit_menu boolean default false;

alter table public.home_members
  add column if not exists can_manage_menu boolean default false;

alter table public.home_members
  add column if not exists can_archive_residence boolean default false;

alter table public.home_members
  add column if not exists can_use_scan boolean default false;

alter table public.home_members
  add column if not exists can_manage_dish_repertoire boolean default false;

update public.home_members
set
  role = coalesce(role, 'staff'),
  can_edit_pantry = coalesce(can_edit_pantry, false),
  can_add_shopping_items = coalesce(can_add_shopping_items, true),
  can_log_meals = coalesce(can_log_meals, false),
  can_manage_team = coalesce(can_manage_team, false),
  can_edit_menu = coalesce(can_edit_menu, false),
  can_manage_menu = coalesce(can_manage_menu, false),
  can_archive_residence = coalesce(can_archive_residence, false),
  can_use_scan = coalesce(can_use_scan, false),
  can_manage_dish_repertoire = coalesce(can_manage_dish_repertoire, false)
where removed_at is null;

update public.home_members
set
  can_edit_pantry = true,
  can_add_shopping_items = true,
  can_log_meals = true,
  can_manage_team = true,
  can_edit_menu = true,
  can_manage_menu = true,
  can_archive_residence = true,
  can_use_scan = true,
  can_manage_dish_repertoire = true
where role = 'admin'
  and removed_at is null;

update public.home_members
set
  can_edit_pantry = true,
  can_add_shopping_items = true,
  can_log_meals = true,
  can_manage_team = false,
  can_edit_menu = true,
  can_manage_menu = true,
  can_archive_residence = false,
  can_use_scan = true,
  can_manage_dish_repertoire = true
where role = 'manager'
  and removed_at is null;

update public.home_members
set
  can_edit_pantry = false,
  can_add_shopping_items = true,
  can_log_meals = false,
  can_manage_team = false,
  can_edit_menu = false,
  can_manage_menu = false,
  can_archive_residence = false,
  can_use_scan = false,
  can_manage_dish_repertoire = false
where role = 'staff'
  and removed_at is null;

update public.home_members
set
  can_edit_pantry = false,
  can_add_shopping_items = false,
  can_log_meals = false,
  can_manage_team = false,
  can_edit_menu = false,
  can_manage_menu = false,
  can_archive_residence = false,
  can_use_scan = false,
  can_manage_dish_repertoire = false
where role = 'viewer'
  and removed_at is null;

update public.home_members
set
  can_edit_pantry = false,
  can_add_shopping_items = true,
  can_log_meals = false,
  can_manage_team = false,
  can_edit_menu = false,
  can_manage_menu = false,
  can_archive_residence = false,
  can_use_scan = false,
  can_manage_dish_repertoire = false
where removed_at is null
  and coalesce(role, '') not in ('admin', 'manager', 'staff', 'viewer');

alter table public.home_members drop constraint if exists home_members_role_check;
alter table public.home_members add constraint home_members_role_check
  check (role in ('admin', 'manager', 'staff', 'viewer'));

-- -----------------------------------------------------------------------------
-- 2. Helper functions (security definer, no RLS recursion issues)
-- -----------------------------------------------------------------------------

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
    select 1 from public.home_members hm
    where hm.home_id = p_home_id
      and hm.user_id = auth.uid()
      and hm.removed_at is null
  );
$$;

create or replace function public.can_manage_home_team(p_home_id uuid)
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

-- Alias used by earlier migrations / app RPC internals
create or replace function public.can_manage_team(p_home_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.can_manage_home_team(p_home_id);
$$;

create or replace function public.can_administer_home(p_home_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.can_manage_home_team(p_home_id);
$$;

create or replace function public.member_can_edit_pantry(p_home_id uuid)
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
      and hm.can_edit_pantry = true
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
    select 1 from public.home_members hm
    where hm.home_id = p_home_id
      and hm.user_id = auth.uid()
      and hm.removed_at is null
      and hm.can_add_shopping_items = true
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
    select 1 from public.home_members hm
    where hm.home_id = p_home_id
      and hm.user_id = auth.uid()
      and hm.removed_at is null
      and hm.can_log_meals = true
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
      and (
        hm.can_edit_menu = true
        or hm.can_manage_menu = true
        or hm.role in ('admin', 'manager')
      )
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
    select 1 from public.home_members hm
    where hm.home_id = p_home_id
      and hm.user_id = auth.uid()
      and hm.removed_at is null
      and hm.role in ('admin', 'manager', 'staff')
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

-- -----------------------------------------------------------------------------
-- 3. Homes: members only see residences they belong to
-- -----------------------------------------------------------------------------

drop policy if exists "Home owners and members can view" on homes;
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

drop policy if exists "Owners can insert homes" on homes;
create policy "Owners can insert homes" on homes
  for insert to authenticated
  with check (auth.uid() = owner_id);

-- -----------------------------------------------------------------------------
-- 4. Team roles RLS (pantry, shopping, meals, menu, homes, home_members)
-- -----------------------------------------------------------------------------

drop policy if exists "Members view pantry" on pantry_items;
drop policy if exists "Pantry editors can write" on pantry_items;
drop policy if exists "Pantry editors can update" on pantry_items;

create policy "Members view pantry" on pantry_items
  for select using (public.member_can_view_pantry(home_id));

create policy "Pantry editors can write" on pantry_items
  for insert with check (public.member_can_edit_pantry(home_id));

create policy "Pantry editors can update" on pantry_items
  for update using (public.member_can_edit_pantry(home_id));

drop policy if exists "Members view shopping" on shopping_items;
drop policy if exists "Members add shopping items" on shopping_items;
drop policy if exists "Members update own shopping items" on shopping_items;

create policy "Members view shopping" on shopping_items
  for select using (public.member_can_view_shopping(home_id));

create policy "Members add shopping items" on shopping_items
  for insert with check (public.member_can_add_shopping(home_id));

create policy "Members update own shopping items" on shopping_items
  for update using (public.member_can_add_shopping(home_id));

drop policy if exists "Members view meals" on prepared_meals;
drop policy if exists "Meal loggers can insert" on prepared_meals;
drop policy if exists "Meal loggers can update" on prepared_meals;

create policy "Members view meals" on prepared_meals
  for select using (public.is_home_member(home_id));

create policy "Meal loggers can insert" on prepared_meals
  for insert with check (public.member_can_log_meals(home_id));

create policy "Meal loggers can update" on prepared_meals
  for update using (public.member_can_log_meals(home_id));

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

drop policy if exists "Owners can update homes" on homes;
drop policy if exists "Owners and admins can update homes" on homes;
create policy "Owners and admins can update homes" on homes
  for update to authenticated
  using (public.can_administer_home(id))
  with check (public.can_administer_home(id));

drop policy if exists "Owners manage members" on home_members;
drop policy if exists "Owners and admins manage members" on home_members;
create policy "Owners and admins manage members" on home_members
  for all to authenticated
  using (public.can_manage_home_team(home_id))
  with check (public.can_manage_home_team(home_id));

-- -----------------------------------------------------------------------------
-- 5. Invite by email (lookup profile + team visibility)
-- -----------------------------------------------------------------------------

create or replace function public.lookup_profile_id_for_team(
  p_home_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can_manage_home_team(p_home_id) then
    return null;
  end if;

  select id into v_id
  from public.profiles
  where lower(trim(email)) = lower(trim(p_email))
  limit 1;

  return v_id;
end;
$$;

grant execute on function public.lookup_profile_id_for_team(uuid, text) to authenticated;

drop policy if exists "View home members" on home_members;
create policy "View home members" on home_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_manage_home_team(home_id)
  );

drop policy if exists "Team managers view member profiles" on profiles;
create policy "Team managers view member profiles" on profiles
  for select to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1 from public.home_members hm
      where hm.user_id = profiles.id
        and hm.removed_at is null
        and public.can_manage_home_team(hm.home_id)
    )
  );

-- Done.

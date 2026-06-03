-- Prerequisite for 20250101000006_team_roles_rls.sql
-- Production-safe: adds home_members permission columns if missing (no drops, no RLS off).

-- Core membership fields (older schemas may omit these)
alter table public.home_members
  add column if not exists role text default 'staff';

alter table public.home_members
  add column if not exists invited_by uuid references public.profiles(id);

alter table public.home_members
  add column if not exists created_at timestamptz default now();

alter table public.home_members
  add column if not exists removed_at timestamptz;

-- Permission flags used by team RLS functions and the app UI
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
  add column if not exists can_archive_residence boolean default false;

alter table public.home_members
  add column if not exists can_use_scan boolean default false;

alter table public.home_members
  add column if not exists can_manage_dish_repertoire boolean default false;

-- Normalize nulls on existing rows before backfill
update public.home_members
set
  role = coalesce(role, 'staff'),
  can_edit_pantry = coalesce(can_edit_pantry, false),
  can_add_shopping_items = coalesce(can_add_shopping_items, true),
  can_log_meals = coalesce(can_log_meals, false),
  can_manage_team = coalesce(can_manage_team, false),
  can_edit_menu = coalesce(can_edit_menu, false),
  can_archive_residence = coalesce(can_archive_residence, false),
  can_use_scan = coalesce(can_use_scan, false),
  can_manage_dish_repertoire = coalesce(can_manage_dish_repertoire, false)
where removed_at is null;

-- Admin (co-admin member): full member permissions + team/archive
update public.home_members
set
  can_edit_pantry = true,
  can_add_shopping_items = true,
  can_log_meals = true,
  can_manage_team = true,
  can_edit_menu = true,
  can_archive_residence = true,
  can_use_scan = true,
  can_manage_dish_repertoire = true
where role = 'admin'
  and removed_at is null;

-- Manager / Chef
update public.home_members
set
  can_edit_pantry = true,
  can_add_shopping_items = true,
  can_log_meals = true,
  can_manage_team = false,
  can_edit_menu = true,
  can_archive_residence = false,
  can_use_scan = true,
  can_manage_dish_repertoire = true
where role = 'manager'
  and removed_at is null;

-- Staff / Assistant
update public.home_members
set
  can_edit_pantry = false,
  can_add_shopping_items = true,
  can_log_meals = false,
  can_manage_team = false,
  can_edit_menu = false,
  can_archive_residence = false,
  can_use_scan = false,
  can_manage_dish_repertoire = false
where role = 'staff'
  and removed_at is null;

-- Viewer (read-only menu + meals; no pantry/shopping writes)
update public.home_members
set
  can_edit_pantry = false,
  can_add_shopping_items = false,
  can_log_meals = false,
  can_manage_team = false,
  can_edit_menu = false,
  can_archive_residence = false,
  can_use_scan = false,
  can_manage_dish_repertoire = false
where role = 'viewer'
  and removed_at is null;

-- Legacy rows with unknown role: treat as staff
update public.home_members
set
  can_edit_pantry = false,
  can_add_shopping_items = true,
  can_log_meals = false,
  can_manage_team = false,
  can_edit_menu = false,
  can_archive_residence = false,
  can_use_scan = false,
  can_manage_dish_repertoire = false
where removed_at is null
  and coalesce(role, '') not in ('admin', 'manager', 'staff', 'viewer');

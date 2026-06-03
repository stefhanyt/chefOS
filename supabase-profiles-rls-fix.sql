-- Run once in Supabase SQL Editor (Production).
-- Fixes: "new row violates row-level security policy for table profiles"
--
-- profiles.id = auth.users.id (not user_id). All checks use auth.uid() = id.

-- ── profiles ────────────────────────────────────────────────────────────────
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

-- SELECT: own row only (anon has auth.uid() null → denied)
create policy "Users can view own profile" on profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- INSERT: create own profile row only
create policy "Users can insert own profile" on profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- UPDATE: own row only (required for upsert update path + settings)
create policy "Users can update own profile" on profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── homes (residences) — owner write, member read via is_home_member ─────────
drop policy if exists "Owners can update homes" on homes;

create policy "Owners can update homes" on homes
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can delete homes" on homes;

create policy "Owners can delete homes" on homes
  for delete
  to authenticated
  using (auth.uid() = owner_id);

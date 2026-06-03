-- Idempotent: profiles RLS (fixes "new row violates row-level security policy for table profiles")
-- Safe on existing production. profiles.id = auth.users.id

drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

create policy "Users can view own profile" on profiles
  for select to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile" on profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Homes owner write policies (re-apply if missing or outdated)
drop policy if exists "Owners can update homes" on homes;
create policy "Owners can update homes" on homes
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can delete homes" on homes;
create policy "Owners can delete homes" on homes
  for delete to authenticated
  using (auth.uid() = owner_id);

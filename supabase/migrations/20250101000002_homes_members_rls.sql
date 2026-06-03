-- Idempotent: homes / home_members RLS without infinite recursion
-- Replaces policies that called is_home_member() from home_members SELECT.

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
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "View home members" on home_members;
create policy "View home members" on home_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_home_owner(home_id)
  );

drop policy if exists "Owners manage members" on home_members;
create policy "Owners manage members" on home_members
  for all to authenticated
  using (public.is_home_owner(home_id))
  with check (public.is_home_owner(home_id));

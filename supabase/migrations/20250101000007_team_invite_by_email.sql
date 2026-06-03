-- Team invite by email: owners/admins can look up accounts and see member profiles

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
  if not public.can_manage_team(p_home_id) then
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
    or public.can_manage_team(home_id)
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
        and public.can_manage_team(hm.home_id)
    )
  );

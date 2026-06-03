-- Product polish: residence notes split + activity log

alter table public.homes
  add column if not exists private_notes text;

alter table public.homes
  add column if not exists team_notes text;

update public.homes
set team_notes = coalesce(nullif(trim(team_notes), ''), nullif(trim(notes), ''))
where team_notes is null and notes is not null;

create table if not exists public.residence_activity (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists residence_activity_home_created_idx
  on public.residence_activity (home_id, created_at desc);

alter table public.residence_activity enable row level security;

drop policy if exists "Members view residence activity" on residence_activity;
create policy "Members view residence activity" on residence_activity
  for select to authenticated
  using (public.is_home_member(home_id));

drop policy if exists "Members log residence activity" on residence_activity;
create policy "Members log residence activity" on residence_activity
  for insert to authenticated
  with check (
    public.is_home_member(home_id)
    and user_id = auth.uid()
  );

-- Run in Supabase SQL Editor if pantry INSERT fails but meals/homes work.
-- Often caused by RLS: pantry insert requires can_edit_pantry on home_members.

-- Option A: Allow any home member (owner or member) to manage pantry (matches meal visibility)
drop policy if exists "Pantry editors can write" on pantry_items;
drop policy if exists "Pantry editors can update" on pantry_items;

create policy "Pantry editors can write" on pantry_items
  for insert with check (is_home_member(home_id));

create policy "Pantry editors can update" on pantry_items
  for update using (is_home_member(home_id));

-- Option B: Disable RLS on pantry_items for local testing only
-- alter table pantry_items disable row level security;

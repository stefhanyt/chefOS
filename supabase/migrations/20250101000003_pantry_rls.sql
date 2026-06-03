-- Idempotent: pantry RLS — any home member may insert/update (not only can_edit_pantry flag)
-- Run if pantry scan/save fails while meals and homes work.

drop policy if exists "Pantry editors can write" on pantry_items;
drop policy if exists "Pantry editors can update" on pantry_items;

create policy "Pantry editors can write" on pantry_items
  for insert with check (public.is_home_member(home_id));

create policy "Pantry editors can update" on pantry_items
  for update using (public.is_home_member(home_id));

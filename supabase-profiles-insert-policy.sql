-- Run in Supabase SQL Editor if Add Residence fails with RLS on homes
-- and profile upsert from the app returns permission denied.
-- Existing projects created before this policy need this one-time fix.

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- Run once in Supabase SQL Editor to enable ChefOS product memory for barcode scan.

create table if not exists product_catalog (
  id uuid primary key default gen_random_uuid(),
  barcode text not null,
  product_name text not null,
  brand text,
  default_quantity numeric,
  default_unit text,
  default_category text,
  notes text,
  created_by uuid references profiles(id) not null,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (barcode, created_by)
);

alter table product_catalog enable row level security;

drop policy if exists "Users view own catalog" on product_catalog;
drop policy if exists "Users insert own catalog" on product_catalog;
drop policy if exists "Users update own catalog" on product_catalog;
drop policy if exists "Users delete own catalog" on product_catalog;

create policy "Users view own catalog" on product_catalog
  for select to authenticated using (auth.uid() = created_by);
create policy "Users insert own catalog" on product_catalog
  for insert to authenticated with check (auth.uid() = created_by);
create policy "Users update own catalog" on product_catalog
  for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);
create policy "Users delete own catalog" on product_catalog
  for delete to authenticated using (auth.uid() = created_by);

-- Idempotent: Dish Repertoire — structured ingredients + extended dish_library fields

alter table dish_library add column if not exists description text;
alter table dish_library add column if not exists meal_category text;
alter table dish_library add column if not exists cuisine_style text;
alter table dish_library add column if not exists dietary_tags text[] default '{}';
alter table dish_library add column if not exists instructions text;
alter table dish_library add column if not exists default_servings integer default 4;
alter table dish_library add column if not exists is_active boolean default true;
alter table dish_library add column if not exists residence_notes jsonb default '{}';

create table if not exists dish_ingredients (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references dish_library(id) on delete cascade,
  sort_order integer default 0,
  name text not null,
  quantity numeric default 1,
  unit text,
  category text,
  notes text,
  created_at timestamp default now()
);

create index if not exists dish_ingredients_dish_id_idx on dish_ingredients(dish_id);

alter table dish_ingredients enable row level security;

drop policy if exists "View dish ingredients" on dish_ingredients;
drop policy if exists "Manage own dish ingredients" on dish_ingredients;

create policy "View dish ingredients" on dish_ingredients
  for select to authenticated
  using (
    exists (
      select 1 from dish_library d
      where d.id = dish_ingredients.dish_id
        and d.archived_at is null
    )
  );

create policy "Manage own dish ingredients" on dish_ingredients
  for all to authenticated
  using (
    exists (
      select 1 from dish_library d
      where d.id = dish_ingredients.dish_id
        and d.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from dish_library d
      where d.id = dish_ingredients.dish_id
        and d.created_by = auth.uid()
    )
  );

# ChefOS Supabase migrations

SQL changes live under `supabase/migrations/` in **timestamp order**. Scripts are **idempotent** (`if not exists`, `drop policy if exists`, `create or replace function`) and do **not** drop tables or truncate data.

## Migration index

| File | Purpose |
|------|---------|
| `20250101000000_base_schema.sql` | Full schema + initial RLS (new projects only) |
| `20250101000001_profiles_rls.sql` | Profile INSERT/UPDATE; homes owner policies |
| `20250101000002_homes_members_rls.sql` | Homes ↔ `home_members` RLS; `is_home_owner()` |
| `20250101000003_pantry_rls.sql` | Early pantry member policies *(superseded by 006)* |
| `20250101000004_product_catalog.sql` | `product_catalog` + RLS (`/scan`) |
| `20250101000005_dish_repertoire.sql` | `dish_ingredients`, dish library columns |
| `202501010000051_home_members_permissions.sql` | Permission columns on `home_members` **(required before 006)** |
| `20250101000006_team_roles_rls.sql` | Role helpers + pantry/shopping/meals/menu/team RLS |
| `20250101000007_team_invite_by_email.sql` | `lookup_profile_id_for_team` RPC + profile visibility |
| `20250101000008_product_polish.sql` | `private_notes`, `team_notes`, `residence_activity` |

## Fresh database (new Supabase project)

Run **one** file in SQL Editor:

`migrations/20250101000000_base_schema.sql`

Then apply **006 → 007 → 008** if you need team roles and product polish (000051 columns are not in the base file—run 051 before 006, or use the consolidated team script below).

## Existing production (incremental)

Run only migrations you have **not** applied, in numeric order. After each run, note it in your deploy log so you do not repeat unnecessarily.

### Typical checklist (ChefOS deployed with `supabase-schema.sql`)

1. `000001` — profiles RLS if residence create failed
2. `000002` — homes/members recursion fix
3. `000003` — optional; **006 replaces pantry policies**
4. `000004` — barcode catalog
5. `000005` — dish repertoire
6. **`000051`** — permission columns (**must run before 006**)
7. `000006` — team roles + RLS
8. `000007` — invite by email
9. `000008` — notes split + activity log (optional for MVP polish UI)

### One-shot team fix (SQL Editor)

If **006 failed** because columns were missing, run once at repo root:

[`supabase-team-access-production-fix.sql`](../supabase-team-access-production-fix.sql)

This merges **051 + 006 + 007**. Do not run 051/006/007 again afterward unless you know they are still missing (script is idempotent).

For **008** only, run `20250101000008_product_polish.sql` separately.

## Role-based access (RLS + app)

| Role | Pantry | Shopping | Meals | Menu | Scan | Dish repertoire | Team | Archive home |
|------|--------|----------|-------|------|------|-----------------|------|--------------|
| **Owner** (`homes.owner_id`) | edit | add/update | log | edit | yes | yes | yes | yes |
| **Admin** | edit | add/update | log | edit | yes | yes | yes | yes |
| **Manager** | edit | add/update | log | edit | yes | yes | no | no |
| **Staff** | view | add/update | view | view | no | no | no | no |
| **Viewer** | — | — | view | view | no | no | no | no |

RLS uses `home_members` boolean columns and helpers (`member_can_edit_pantry`, `member_can_edit_menu`, `can_manage_home_team`, etc.). The app mirrors roles via `lib/home-access.ts` and `hooks/useHomeAccess.ts`.

**Naming:** `can_manage_team` on `home_members` is a **column**; `can_manage_home_team(uuid)` / `can_manage_team(uuid)` are **SQL functions**.

## Legacy root SQL (deprecated)

| Old path | Use instead |
|----------|-------------|
| `supabase-schema.sql` | `00000000_base_schema.sql` |
| `supabase-profiles-rls-fix.sql` | `000001` |
| `supabase-pantry-rls-fix.sql` | `000003` (then `006` or consolidated team fix) |
| `supabase-product-catalog.sql` | `000004` |
| `supabase-dish-repertoire.sql` | `000005` |

## Supabase CLI (optional)

```bash
supabase db push
```

Otherwise: **Dashboard → SQL → New query**, paste each migration, run.

## PostgREST: `home_members` + `profiles` embed

`home_members` references `profiles` twice (`user_id`, `invited_by`). A bare `profile:profiles(...)` fails with *more than one relationship was found*.

Use the **member user** FK, not `invited_by`:

```sql
-- In app (lib/supabase/team.ts):
profile:profiles!home_members_user_id_fkey(id, display_name, email)
```

**Find the exact FK name in your project:**

1. Search migrations/SQL for `home_members_user_id_fkey`, or
2. Supabase **Database → Tables → home_members → Foreign keys** — pick the row where `user_id` → `profiles.id`.

## Data safety

- No `DROP TABLE` or data wipes in these migrations.
- Residence archive is soft (`homes.archived_at`).
- Re-running idempotent scripts only updates policies, functions, and missing columns/tables.

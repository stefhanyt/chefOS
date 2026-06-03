# ChefOS

Private chef command center — pantry, meals, shopping, weekly menus, and staff management across multiple residences.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Supabase (Auth + Database + Realtime)
- @zxing/browser (barcode scanning)
- Anthropic Claude API (photo scan + AI features)

## Quick Start

```bash
npm install
npm run dev
```

App runs on mock data immediately — no Supabase required.

## Add Supabase

1. Create a project at supabase.com
2. Copy `.env.local.example` → `.env.local`
3. Fill in your Supabase URL and anon key
4. Run `supabase-schema.sql` in your Supabase SQL editor
5. Restart the dev server

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Home dashboard with alerts and quick actions |
| `/homes` | All residences |
| `/homes/[id]` | Single residence detail |
| `/pantry` | Pantry inventory with quantity controls |
| `/shopping-list` | Collaborative shopping list grouped by property |
| `/meals` | Prepared meals with expiry tracking |
| `/menu` | Weekly menu planner per property |
| `/dish-library` | Dish Repertoire — reusable dishes for menus & shopping |
| `/scan` | Single barcode scanner (Open Food Facts lookup) |
| `/scan/batch` | Batch barcode scanner |
| `/scan/photo` | Photo scan — AI identifies all items from one photo |
| `/settings` | Profile and app settings |
| `/settings/team` | Staff access management per residence |

## Key Features

- **Multi-property** — each residence has independent pantry, shopping list, and menus
- **Weekly Menu Planner** — Mike builds the weekly menu per property, confirms it, team is notified
- **Photo Scan** — photograph a shelf or delivery, Claude Vision identifies every item
- **Barcode Scanner** — single or batch scan with Open Food Facts product lookup
- **Collaborative Shopping** — staff can add items, grouped by property
- **Meal Expiry Tracking** — Fresh / Use Soon / Expired status with alerts
- **Staff Access Control** — per-property roles with granular permissions

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

The app falls back to mock data if these are not set.

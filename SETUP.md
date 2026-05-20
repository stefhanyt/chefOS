# ChefOS — Deployment Setup Guide

## What you need before you start

- Node.js 18+ installed on your computer
- A [Supabase](https://supabase.com) account (free tier is fine)
- A [Vercel](https://vercel.com) account (free tier is fine)
- An [Anthropic](https://console.anthropic.com) API key (optional — only needed for Photo Scan)

---

## Step 1 — Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Choose a name (e.g. `chefos`), set a strong database password, pick the region closest to you
3. Wait ~2 minutes for the project to provision

### Run the schema

4. In the Supabase dashboard, open **SQL Editor** → **New query**
5. Paste the entire contents of `supabase-schema.sql` (in this repo root) and click **Run**
   - This creates all tables, enables RLS, adds policies, and sets up the `on_auth_user_created` trigger

### Enable Realtime

6. Still in SQL Editor, run:
```sql
alter publication supabase_realtime add table shopping_items;
alter publication supabase_realtime add table pantry_items;
```

### Get your API keys

7. Go to **Project Settings → API**
8. Copy **Project URL** — this is your `NEXT_PUBLIC_SUPABASE_URL`
9. Copy the **anon / public** key — this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Step 2 — Local development

```bash
# Clone and install
cd chefos
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key

# Generate PWA icons (one-time, requires sharp)
npm install --save-dev sharp
node scripts/generate-icons.mjs

# Start dev server
npm run dev
# Open http://localhost:3000
```

The app falls back to read-only mock data when Supabase isn't configured — useful for UI work without a live DB.

---

## Step 3 — Deploy to Vercel

### Option A — Vercel CLI (fastest)

```bash
npm i -g vercel
vercel login
vercel --prod
```

When prompted, accept all defaults. Vercel detects Next.js automatically.

### Option B — GitHub + Vercel dashboard

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import your repo
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy** — first deploy will fail because env vars aren't set yet (that's fine)

### Set environment variables in Vercel

Go to your Vercel project → **Settings → Environment Variables** and add:

| Variable | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon key | Production, Preview, Development |
| `ANTHROPIC_API_KEY` | your Anthropic API key | Production, Preview (optional) |

After adding variables → **Deployments → Redeploy** (no build cache).

---

## Step 4 — Set Supabase auth redirect URL

After your Vercel deployment is live:

1. Supabase dashboard → **Authentication → URL Configuration**
2. **Site URL**: `https://your-app.vercel.app`
3. **Redirect URLs**: add `https://your-app.vercel.app/auth/callback`
4. For local dev also add: `http://localhost:3000/auth/callback`

---

## Step 5 — Install as PWA on iPhone

1. Open your Vercel URL in **Safari** on iPhone (must be Safari — Chrome can't install PWAs on iOS)
2. Tap the **Share** button (square with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** — ChefOS appears on your home screen like a native app

The app works fully offline for browsing cached data. Writes sync when connection returns.

---

## Step 6 — Create your first account

1. Open the app → you'll be redirected to `/login`
2. Enter your email and tap **Send Magic Link** (passwordless, easiest on mobile)
3. Check your email and tap the link — you're in
4. Your profile is created automatically on first login

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (for real data) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (for real data) | Supabase public anon key |
| `ANTHROPIC_API_KEY` | No | Enables AI Photo Scan feature |

Without Supabase vars the app runs in **demo mode** — all pages work with mock data but nothing persists.

---

## Health check

After deployment, verify everything is wired up:

```
GET https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-...",
  "services": {
    "supabase": "configured",
    "anthropic": "configured"
  }
}
```

If any service shows `"missing"`, re-check the environment variables in Vercel and redeploy.

---

## Troubleshooting

**"Auth session missing" after magic link click**
- Make sure the redirect URL in Supabase matches your deployment URL exactly (no trailing slash)

**Camera not working on iPhone**
- Must be accessed over HTTPS (Vercel provides this automatically)
- Safari: Settings → Safari → Camera → Allow for your domain
- If camera is blocked, use the "Use Photo Library" button to scan from an image

**Realtime not updating**
- Run the `alter publication` SQL from Step 1 if you skipped it
- Supabase free tier limits: 200 concurrent realtime connections

**Photo Scan shows "not configured"**
- Add `ANTHROPIC_API_KEY` to Vercel env vars and redeploy
- All other features work without this key

**PWA not installing**
- Must use Safari on iOS (not Chrome, Firefox, etc.)
- Must be HTTPS — localhost won't prompt for install
- The manifest icons need to exist: run `node scripts/generate-icons.mjs` and redeploy

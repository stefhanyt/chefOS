const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

const missing: string[] = []
if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
if (!key) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

// Only log server-side so it appears in the terminal, not the browser console
if (missing.length > 0 && typeof window === 'undefined') {
  console.warn(
    `\n⚠️  ChefOS — Supabase not configured (missing: ${missing.join(', ')})\n` +
    `   Configure Supabase in .env.local to enable the app.\n` +
    `   To connect to a real database:\n` +
    `   1. cp .env.local.example .env.local\n` +
    `   2. Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY\n` +
    `      (Project Settings → API in the Supabase dashboard)\n` +
    `   3. Restart the dev server\n`,
  )
}

type EnvResult =
  | { configured: true; url: string; key: string }
  | { configured: false; url: null; key: null }

export const supabaseEnv: EnvResult =
  missing.length === 0
    ? { configured: true, url: url!, key: key! }
    : { configured: false, url: null, key: null }

export const isSupabaseConfigured = supabaseEnv.configured

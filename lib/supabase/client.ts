import { createBrowserClient } from "@supabase/ssr"
import { supabaseEnv, isSupabaseConfigured } from "@/lib/env"
import { isBrowser } from "@/lib/safe-client"
import { getSupabaseAuthStorage } from "@/lib/supabase/safe-storage"

export { isSupabaseConfigured }

// Returns null if env vars are not set — callers must show a configuration error
export function createClient() {
  if (!supabaseEnv.configured) return null
  if (!isBrowser()) return null

  try {
    return createBrowserClient(supabaseEnv.url, supabaseEnv.key, {
      auth: {
        storage: getSupabaseAuthStorage(),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  } catch (err) {
    console.error("[ChefOS] Failed to create Supabase client:", err)
    return null
  }
}

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { supabaseEnv, isSupabaseConfigured } from "@/lib/env"
import { isBrowser } from "@/lib/safe-client"

export { isSupabaseConfigured }

let browserClient: SupabaseClient | null = null

// Cookie-backed session (syncs with middleware). Do not override with localStorage.
export function createClient() {
  if (!supabaseEnv.configured) return null
  if (!isBrowser()) return null

  try {
    if (!browserClient) {
      browserClient = createBrowserClient(supabaseEnv.url, supabaseEnv.key)
    }
    return browserClient
  } catch (err) {
    console.error("[ChefOS] Failed to create Supabase client:", err)
    return null
  }
}

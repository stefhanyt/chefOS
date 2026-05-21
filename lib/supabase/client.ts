import { createBrowserClient } from "@supabase/ssr"
import { supabaseEnv, isSupabaseConfigured } from "@/lib/env"

export { isSupabaseConfigured }

// Returns null if env vars are not set — callers must show a configuration error
export function createClient() {
  if (!supabaseEnv.configured) return null
  return createBrowserClient(supabaseEnv.url, supabaseEnv.key)
}

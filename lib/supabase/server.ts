import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseEnv } from "@/lib/env"

// Returns null if env vars are not set — callers fall back to mock data
export function createServerSupabaseClient() {
  if (!supabaseEnv.configured) return null

  const cookieStore = cookies()

  return createServerClient(supabaseEnv.url, supabaseEnv.key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // Throws in Server Components (read-only cookies). Safe to ignore —
          // auth middleware handles the actual cookie writes.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options })
        } catch {}
      },
    },
  })
}

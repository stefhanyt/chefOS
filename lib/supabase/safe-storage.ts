import type { SupportedStorage } from "@supabase/supabase-js"
import { safeLocalStorage } from "@/lib/safe-client"

/**
 * In-memory fallback when localStorage is blocked (common on iOS private mode).
 * Session won't persist across reloads but the app won't crash.
 */
function createMemoryStorage(): SupportedStorage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

let cached: SupportedStorage | null = null

export function getSupabaseAuthStorage(): SupportedStorage {
  if (cached) return cached
  const ls = safeLocalStorage()
  cached = ls ?? createMemoryStorage()
  return cached
}

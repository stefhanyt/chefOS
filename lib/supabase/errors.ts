import type { PostgrestError } from "@supabase/supabase-js"

export function logSupabaseError(context: string, error: unknown): void {
  console.error(`[Supabase] ${context}`, error)
}

export function getSupabaseErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as PostgrestError).message)
  }
  return "Something went wrong. Please try again."
}

import type { PostgrestError } from "@supabase/supabase-js"

export function logSupabaseError(context: string, error: unknown): void {
  console.error(`[Supabase] ${context}`, error)
}

/** Safe diagnostics for homes insert — no email or tokens. */
export function logHomeInsertDiagnostic(
  context: string,
  payload: {
    name: string
    location: string
    notes: string | null
    owner_id: string
  },
  meta: {
    authUserId: string
    sessionUserId: string | null
    hasAccessToken: boolean
  },
): void {
  console.info(`[Supabase] ${context}`, {
    name: payload.name,
    location: payload.location,
    hasNotes: Boolean(payload.notes),
    owner_id: payload.owner_id,
    owner_idPresent: Boolean(payload.owner_id),
    authUserId: meta.authUserId,
    sessionUserId: meta.sessionUserId,
    authMatchesOwner: meta.authUserId === payload.owner_id,
    sessionMatchesOwner: meta.sessionUserId === payload.owner_id,
    hasAccessToken: meta.hasAccessToken,
  })
}

export function getSupabaseErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as PostgrestError).message)
  }
  return "Something went wrong. Please try again."
}

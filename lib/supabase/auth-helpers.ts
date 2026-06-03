import type { AuthError, SupabaseClient, User } from "@supabase/supabase-js"
import { logSupabaseError } from "@/lib/supabase/errors"

export async function getAuthUser(
  supabase: SupabaseClient,
): Promise<{ user: User | null; error: AuthError | null }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) return { user: null, error }
  if (!user) return { user: null, error: null }
  return { user, error: null }
}

export async function getAuthUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { user } = await getAuthUser(supabase)
  return user?.id ?? null
}

/**
 * Ensures a profiles row exists (id must equal auth.uid()).
 * Uses insert or update — not upsert — so RLS insert/update policies apply cleanly.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<{ error: unknown }> {
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    logSupabaseError("ensureUserProfile auth", authError)
    return { error: authError }
  }
  if (!authUser) {
    return { error: new Error("User not authenticated") }
  }

  const profileId = authUser.id
  if (user.id !== profileId) {
    console.error("[Supabase] ensureUserProfile id mismatch", {
      passedUserId: user.id,
      authUserId: profileId,
    })
  }

  const email = authUser.email ?? ""
  const displayName =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (email ? email.split("@")[0] : "Chef")

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle()

  if (selectError) {
    logSupabaseError("ensureUserProfile select", selectError)
    return { error: selectError }
  }

  if (existing) {
    console.info("[Supabase] ensureUserProfile update", {
      profileId,
      profileIdMatchesAuth: profileId === authUser.id,
    })
    const { error } = await supabase
      .from("profiles")
      .update({
        email,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)

    if (error) logSupabaseError("ensureUserProfile update", error)
    return { error: error ?? null }
  }

  const insertPayload = {
    id: profileId,
    email,
    display_name: displayName,
    role: "user",
  }

  console.info("[Supabase] ensureUserProfile insert", {
    profileId: insertPayload.id,
    profileIdMatchesAuth: insertPayload.id === authUser.id,
    owner_idPresent: Boolean(insertPayload.id),
  })

  const { error: insertError } = await supabase
    .from("profiles")
    .insert(insertPayload)

  if (insertError) logSupabaseError("ensureUserProfile insert", insertError)
  return { error: insertError ?? null }
}

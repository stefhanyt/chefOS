import type { AuthError, SupabaseClient, User } from "@supabase/supabase-js"

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

/** Ensures a profiles row exists so homes.owner_id FK and RLS checks succeed. */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<{ error: unknown }> {
  const email = user.email ?? ""
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (email ? email.split("@")[0] : "Chef")

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email,
      display_name: displayName,
      role: "user",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  )

  return { error: error ?? null }
}

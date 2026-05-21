import type { SupabaseClient } from "@supabase/supabase-js"

export async function getAuthUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user.id
}

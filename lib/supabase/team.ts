import type { SupabaseClient } from "@supabase/supabase-js"

/** Resolve a ChefOS user id by email (owner/admin on the given residence only). */
export async function lookupProfileIdForTeamInvite(
  supabase: SupabaseClient,
  homeId: string,
  email: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("lookup_profile_id_for_team", {
    p_home_id: homeId,
    p_email: email.trim(),
  })
  if (error) throw error
  return (data as string | null) ?? null
}

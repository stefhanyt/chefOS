import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * home_members → profiles via user_id (not invited_by).
 * FK: home_members_user_id_fkey (user_id references profiles.id).
 */
export const HOME_MEMBER_PROFILE_EMBED =
  "profile:profiles!home_members_user_id_fkey(id, display_name, email)" as const

export const HOME_MEMBER_WITH_PROFILE_SELECT =
  `*, ${HOME_MEMBER_PROFILE_EMBED}` as const

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

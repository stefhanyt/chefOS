import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Embed member profile on home_members queries.
 *
 * home_members has two FKs to profiles — PostgREST needs an explicit hint:
 * - USE: home_members.user_id → profiles.id  (constraint home_members_user_id_fkey)
 * - NOT: home_members.invited_by → profiles.id (home_members_invited_by_fkey)
 *
 * How to verify the constraint name:
 * - SQL/migrations: search for `home_members_user_id_fkey` or `user_id uuid references profiles`
 * - Supabase Dashboard: Database → Tables → home_members → Foreign keys
 *
 * Equivalent hint if your project renamed the constraint: `profiles!user_id(...)`
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

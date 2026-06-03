import type { SupabaseClient } from "@supabase/supabase-js"
import type { Profile } from "@/lib/types"

export type ResidenceTeamMember = {
  user_id: string
  display_name: string
  email: string
}

/** Owner + home_members for assignee dropdowns. */
export async function fetchResidenceTeam(
  supabase: SupabaseClient,
  homeId: string,
  ownerId: string,
): Promise<ResidenceTeamMember[]> {
  const [ownerRes, membersRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, email")
      .eq("id", ownerId)
      .maybeSingle(),
    supabase
      .from("home_members")
      .select("user_id, profile:profiles(id, display_name, email)")
      .eq("home_id", homeId)
      .is("removed_at", null),
  ])

  const map = new Map<string, ResidenceTeamMember>()

  if (ownerRes.data) {
    const p = ownerRes.data as Profile
    map.set(p.id, {
      user_id: p.id,
      display_name: p.display_name,
      email: p.email,
    })
  }

  for (const row of membersRes.data ?? []) {
    const uid = row.user_id as string
    const raw = row.profile as Profile | Profile[] | null
    const prof = Array.isArray(raw) ? raw[0] : raw
    if (prof?.id) {
      map.set(uid, {
        user_id: uid,
        display_name: prof.display_name,
        email: prof.email,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  )
}

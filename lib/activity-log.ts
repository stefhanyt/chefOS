import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"

/** Best-effort activity entry; never blocks the main action. */
export async function logResidenceActivity(
  supabase: SupabaseClient | null,
  homeId: string,
  summary: string,
): Promise<void> {
  if (!supabase || !homeId || !summary.trim()) return
  try {
    const userId = await getAuthUserId(supabase)
    if (!userId) return
    await supabase.from("residence_activity").insert({
      home_id: homeId,
      user_id: userId,
      summary: summary.trim(),
    })
  } catch {
    /* table may not exist until migration runs */
  }
}

export function activitySummary(
  actorName: string,
  action: string,
): string {
  const who = actorName.trim() || "Someone"
  return `${who} ${action}`
}

export async function getActorDisplayName(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<string> {
  if (!supabase) return "Someone"
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle()
  return data?.display_name?.trim() || "Someone"
}

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Home } from "@/lib/types"
import { logSupabaseError } from "@/lib/supabase/errors"

export async function createHomeWithOwner(
  supabase: SupabaseClient,
  userId: string,
  input: {
    name: string
    location: string
    notes?: string
    kitchen_equipment?: string
    preferences?: string
  },
): Promise<{ home: Home | null; error: unknown }> {
  const { data: home, error: homeError } = await supabase
    .from("homes")
    .insert({
      owner_id: userId,
      name: input.name.trim(),
      location: input.location.trim(),
      notes: input.notes?.trim() || null,
      kitchen_equipment: input.kitchen_equipment?.trim() || null,
      preferences: input.preferences?.trim() || null,
    })
    .select("*")
    .single()

  if (homeError) {
    logSupabaseError("createHome", homeError)
    return { home: null, error: homeError }
  }

  const { error: memberError } = await supabase.from("home_members").insert({
    home_id: home.id,
    user_id: userId,
    role: "admin",
    can_edit_pantry: true,
    can_add_shopping_items: true,
    can_log_meals: true,
    invited_by: userId,
  })

  if (memberError) {
    logSupabaseError("createHomeMember", memberError)
    return { home: null, error: memberError }
  }

  return { home: home as Home, error: null }
}

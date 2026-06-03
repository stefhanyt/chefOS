import type { SupabaseClient } from "@supabase/supabase-js"
import type { Home } from "@/lib/types"
import { ensureUserProfile, getAuthUser } from "@/lib/supabase/auth-helpers"
import { logSupabaseError } from "@/lib/supabase/errors"

export async function createHomeWithOwner(
  supabase: SupabaseClient,
  input: {
    name: string
    location: string
    notes?: string
    kitchen_equipment?: string
    preferences?: string
  },
): Promise<{
  home: Home | null
  error: unknown
  needsLogin?: boolean
}> {
  const { user, error: authError } = await getAuthUser(supabase)
  if (authError) {
    logSupabaseError("createHome auth", authError)
    return { home: null, error: authError, needsLogin: true }
  }
  if (!user) {
    return {
      home: null,
      error: new Error("Not signed in"),
      needsLogin: true,
    }
  }

  const { error: profileError } = await ensureUserProfile(supabase, user)
  if (profileError) {
    logSupabaseError("createHome profile", profileError)
    return { home: null, error: profileError }
  }

  const { data: home, error: homeError } = await supabase
    .from("homes")
    .insert({
      owner_id: user.id,
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
    user_id: user.id,
    role: "admin",
    can_edit_pantry: true,
    can_add_shopping_items: true,
    can_log_meals: true,
    invited_by: user.id,
  })

  if (memberError) {
    logSupabaseError("createHomeMember", memberError)
    return { home: null, error: memberError }
  }

  return { home: home as Home, error: null }
}

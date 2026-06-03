import type { SupabaseClient } from "@supabase/supabase-js"
import type { Home } from "@/lib/types"
import { ensureUserProfile } from "@/lib/supabase/auth-helpers"
import {
  logHomeInsertDiagnostic,
  logSupabaseError,
} from "@/lib/supabase/errors"

/**
 * Used by Add Residence: app/homes/page.tsx → HomeFormModal → handleSaveHome → here.
 */
export async function createHomeWithOwner(
  supabase: SupabaseClient,
  input: {
    name: string
    location: string
    notes?: string
    kitchen_equipment?: string
    preferences?: string
  },
): Promise<Home> {
  const {
    data: { session: initialSession },
  } = await supabase.auth.getSession()

  if (!initialSession?.access_token) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      logSupabaseError("createHome refreshSession", refreshError)
    }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    logSupabaseError("createHome auth", authError)
    throw authError
  }
  if (!user) throw new Error("User not authenticated")

  const { error: profileError } = await ensureUserProfile(supabase, user)
  if (profileError) {
    logSupabaseError("createHome profile", profileError)
    throw profileError
  }

  const insertPayload = {
    name: input.name.trim(),
    location: input.location.trim(),
    notes: input.notes?.trim() || null,
    owner_id: user.id,
    kitchen_equipment: input.kitchen_equipment?.trim() || null,
    preferences: input.preferences?.trim() || null,
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  logHomeInsertDiagnostic("createHome insert payload", insertPayload, {
    authUserId: user.id,
    sessionUserId: session?.user?.id ?? null,
    hasAccessToken: Boolean(session?.access_token),
  })

  const { data: home, error } = await supabase
    .from("homes")
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    logSupabaseError("createHome insert failed", {
      code: (error as { code?: string }).code,
      message: error.message,
      owner_idPresent: Boolean(insertPayload.owner_id),
      authUserId: user.id,
    })
    throw error
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
    throw memberError
  }

  return home as Home
}

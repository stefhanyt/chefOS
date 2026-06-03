import { ensureUserProfile } from "@/lib/supabase/auth-helpers"
import { getSafeRedirectPath } from "@/lib/safe-redirect"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logSupabaseError } from "@/lib/supabase/errors"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const { searchParams } = requestUrl
  const code = searchParams.get("code")
  const next = getSafeRedirectPath(searchParams.get("next"))

  if (code) {
    const supabase = createServerSupabaseClient()

    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        // Auto-create profile row on first login
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { error: profileError } = await ensureUserProfile(supabase, user)
          if (profileError) {
            logSupabaseError("auth callback ensureUserProfile", profileError)
          }
        }

        return NextResponse.redirect(new URL(next, requestUrl))
      }
    }
  }

  // Exchange failed or code missing — send back to login with an error hint
  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", requestUrl),
  )
}

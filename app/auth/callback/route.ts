import { getSafeRedirectPath } from "@/lib/safe-redirect"
import { createServerSupabaseClient } from "@/lib/supabase/server"
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
          const displayName =
            (user.user_metadata?.full_name as string | undefined) ??
            user.email?.split("@")[0] ??
            "Chef"

          try {
            await supabase.from("profiles").upsert(
              {
                id: user.id,
                email: user.email,
                display_name: displayName,
                role: "user",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id", ignoreDuplicates: true },
            )
          } catch {
            // Profile already exists or RLS blocked the write — safe to ignore
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

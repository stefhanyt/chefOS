import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Routes accessible without a session
const PUBLIC_PATHS = ["/login", "/auth/"]

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Mock mode — no Supabase configured, skip auth entirely
  if (!supabaseUrl || !supabaseKey) return response

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value: "", ...options })
      },
    },
  })

  // Refreshes the session cookie if it has expired
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // Authenticated user hitting the login page → send them in
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Unauthenticated user hitting a protected page → send to login
  if (!session && !isPublic) {
    const loginUrl = new URL("/login", request.url)
    // Preserve intended destination (skip root — it just redirects to /dashboard anyway)
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files so they're always accessible
    "/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.json|sw\\.js|workbox-.*|apple-touch-icon).*)",
  ],
}

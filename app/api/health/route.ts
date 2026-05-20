import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY

  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
      services: {
        supabase: supabaseConfigured ? "configured" : "missing",
        anthropic: anthropicConfigured ? "configured" : "missing",
      },
    },
    { status: 200 }
  )
}

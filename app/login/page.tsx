"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/env"
import { getSafeRedirectPath } from "@/lib/safe-redirect"
import { ChefHat, Mail, Lock, ArrowRight } from "lucide-react"

// useSearchParams requires a Suspense boundary during static generation
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F8FC]" />}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const params = useSearchParams()
  const next = getSafeRedirectPath(params.get("next"))

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [magicSent, setMagicSent] = useState(false)
  const [mode, setMode] = useState<"password" | "magic">("password")

  // ── Mock / demo mode ──────────────────────────────────────────
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F8FC] p-6">
        <div className="w-full max-w-sm rounded-[26px] border border-[#E6EEF8] bg-white p-8 text-center shadow-xl shadow-slate-900/8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-blue-50">
            <ChefHat size={28} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">ChefOS — Demo Mode</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Supabase is not configured. The app is running with mock data.
            Add <code className="rounded bg-slate-100 px-1 text-xs">.env.local</code> to
            enable real auth.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F2A55] to-[#2563EB] py-4 text-sm font-bold text-white"
          >
            Enter Demo <ArrowRight size={16} />
          </button>
        </div>
      </div>
    )
  }

  // ── Magic-link sent state ─────────────────────────────────────
  if (magicSent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F8FC] p-6">
        <div className="w-full max-w-sm rounded-[26px] border border-[#E6EEF8] bg-white p-8 text-center shadow-xl shadow-slate-900/8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <Mail className="text-blue-600" size={28} />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Check your email</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            We sent a magic link to{" "}
            <span className="font-bold text-slate-700">{email}</span>. Tap it to
            sign in.
          </p>
          <button
            onClick={() => setMagicSent(false)}
            className="mt-6 text-sm font-bold text-blue-600"
          >
            Try a different address
          </button>
        </div>
      </div>
    )
  }

  // ── Handlers ──────────────────────────────────────────────────
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setMagicSent(true)
    setLoading(false)
  }

  // ── Form ──────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F8FC]">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-[#0F2A55] to-[#2563EB] px-6 pb-12 pt-16 text-center text-white">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/20 backdrop-blur-md">
          <ChefHat size={30} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">ChefOS</h1>
        <p className="mt-2 text-sm text-blue-200">Private chef command center</p>
      </div>

      {/* Card */}
      <div className="-mt-6 flex-1 px-6">
        <div className="rounded-[26px] border border-[#E6EEF8] bg-white p-6 shadow-xl shadow-slate-900/8">
          <h2 className="mb-6 text-xl font-extrabold text-slate-900">Sign in</h2>

          {/* Password / Magic Link toggle */}
          <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
            {(["password", "magic"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors ${
                  mode === m
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {m === "password" ? "Password" : "Magic Link"}
              </button>
            ))}
          </div>

          <form
            onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
            className="space-y-4"
          >
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="chef@example.com"
                  className="w-full rounded-xl border border-slate-200 py-3.5 pl-10 pr-4 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Password (only in password mode) */}
            {mode === "password" && (
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 py-3.5 pl-10 pr-4 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            )}

            {/* Inline error */}
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F2A55] to-[#2563EB] py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  {mode === "password" ? "Sign In" : "Send Magic Link"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

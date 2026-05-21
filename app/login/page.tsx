"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/env"
import { getSafeRedirectPath } from "@/lib/safe-redirect"
import { getWindowOrigin } from "@/lib/safe-client"
import { ChefHat, Mail, Lock, ArrowRight } from "lucide-react"

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ivory" />}>
      <LoginContent />
    </Suspense>
  )
}

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <div className="relative overflow-hidden bg-gradient-to-b from-navy via-navy-light to-navy-soft px-8 pb-16 pt-14 text-center text-ivory">
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-ivory/5 blur-xl"
          aria-hidden
        />
        <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-ivory/20 bg-ivory/10 backdrop-blur-md">
          <ChefHat size={28} strokeWidth={1.5} className="text-gold-light" />
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          ChefOS
        </h1>
        <p className="mt-2 text-sm font-medium tracking-luxury text-ivory/70">
          Private residence operations
        </p>
      </div>
      <div className="-mt-8 flex-1 px-6 pb-10">{children}</div>
    </div>
  )
}

function LoginCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-sm rounded-3xl border border-stone-200/50 bg-surface p-7 shadow-card-lg">
      {children}
    </div>
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

  if (!isSupabaseConfigured) {
    return (
      <LoginShell>
        <LoginCard>
          <div className="text-center">
            <h2 className="font-display text-xl font-semibold text-charcoal">
              Configuration required
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-500">
              Add Supabase credentials to{" "}
              <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-charcoal">
                .env.local
              </code>{" "}
              and restart the server.
            </p>
          </div>
        </LoginCard>
      </LoginShell>
    )
  }

  if (magicSent) {
    return (
      <LoginShell>
        <LoginCard>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-navy/5 text-navy">
              <Mail size={26} strokeWidth={1.5} />
            </div>
            <h2 className="font-display text-xl font-semibold text-charcoal">
              Check your email
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-500">
              We sent a sign-in link to{" "}
              <span className="font-semibold text-charcoal">{email}</span>.
            </p>
            <button
              type="button"
              onClick={() => setMagicSent(false)}
              className="mt-6 text-sm font-semibold text-navy-light hover:text-navy"
            >
              Use a different address
            </button>
          </div>
        </LoginCard>
      </LoginShell>
    )
  }

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
        emailRedirectTo: `${getWindowOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
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

  return (
    <LoginShell>
      <LoginCard>
        <h2 className="mb-6 font-display text-xl font-semibold text-charcoal">
          Sign in
        </h2>

        <div className="mb-6 flex rounded-xl border border-stone-200/80 bg-stone-50/50 p-1">
          {(["password", "magic"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                mode === m
                  ? "bg-surface text-charcoal shadow-card"
                  : "text-stone-500"
              }`}
            >
              {m === "password" ? "Password" : "Magic link"}
            </button>
          ))}
        </div>

        <form
          onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
          className="space-y-4"
        >
          <div>
            <label className="chef-label">Email</label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                strokeWidth={1.5}
              />
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@residence.com"
                className="chef-input pl-11"
              />
            </div>
          </div>

          {mode === "password" && (
            <div>
              <label className="chef-label">Password</label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                  strokeWidth={1.5}
                />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="chef-input pl-11"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="chef-btn-primary flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ivory/30 border-t-ivory" />
            ) : (
              <>
                {mode === "password" ? "Enter residence" : "Send magic link"}
                <ArrowRight size={16} strokeWidth={2} />
              </>
            )}
          </button>
        </form>
      </LoginCard>
    </LoginShell>
  )
}

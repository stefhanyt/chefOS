"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import SignOutButton from "@/components/SignOutButton"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { useToast } from "@/components/ToastProvider"
import { Users, Home, Bell, Shield, ChevronRight } from "lucide-react"
import type { Profile } from "@/lib/types"
import ErrorBanner from "@/components/ErrorBanner"
import { ui } from "@/lib/ui"

const CONFIG_ERROR =
  "Database not configured. Add Supabase credentials to .env.local and restart the dev server."

const settingsGroups = [
  {
    group: "Management",
    items: [
      {
        label: "Team & Access",
        sub: "Manage staff per residence",
        icon: Users,
        href: "/settings/team",
      },
      {
        label: "Homes",
        sub: "Add or edit residences",
        icon: Home,
        href: "/homes",
      },
    ],
  },
  {
    group: "App",
    items: [
      {
        label: "Notifications",
        sub: "Expiry and restock alerts",
        icon: Bell,
        href: "#",
      },
    ],
  },
]

export default function SettingsPage() {
  const { showSuccess, showError } = useToast()
  const [profile, setProfile] = useState<Pick<Profile, "display_name" | "email" | "role"> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState("")

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      if (!supabase) {
        setError(CONFIG_ERROR)
        setLoading(false)
        return
      }
      try {
        const userId = await getAuthUserId(supabase)
        if (!userId) {
          setError("You must be signed in to view settings.")
          setLoading(false)
          return
        }
        const { data, error: dbError } = await supabase
          .from("profiles")
          .select("display_name, email, role")
          .eq("id", userId)
          .single()
        if (dbError) throw dbError
        setProfile(data)
        setEditName(data.display_name ?? "")
      } catch (err) {
        logSupabaseError("settings profile load", err)
        setError("Failed to load profile.")
        showError(getSupabaseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [showError])

  async function handleSaveProfile() {
    const supabase = createClient()
    if (!supabase || !profile) return
    const userId = await getAuthUserId(supabase)
    if (!userId) return

    setSaving(true)
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: editName.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("display_name, email, role")
      .single()
    setSaving(false)

    if (error) {
      logSupabaseError("profile update", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    if (data) setProfile(data)
    showSuccess("Profile updated")
  }

  const initial = profile?.display_name?.charAt(0).toUpperCase() ?? "C"

  return (
    <AppShell>
      <PageHeader title="Settings" />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className={`${ui.skeleton} mb-6 h-32`} />
      ) : profile ? (
        <div className={`mb-7 ${ui.hero}`}>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ivory/20 bg-ivory/10 font-display text-2xl font-semibold backdrop-blur-sm">
              {initial}
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold">{profile.display_name}</h2>
              <p className="text-sm text-ivory/70">{profile.email}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-light/90">
                {profile.role}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && profile && (
        <div className={`${ui.cardElevated} mb-7 p-5`}>
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Edit profile
          </h2>
          <label className="chef-label">Display name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="chef-input mb-4"
          />
          <button
            disabled={saving || !editName.trim()}
            onClick={handleSaveProfile}
            className="chef-btn-primary disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      )}

      {settingsGroups.map((group) => (
        <div key={group.group} className="mb-5">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            {group.group}
          </h2>
          <div className={`${ui.cardInset} overflow-hidden`}>
            {group.items.map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between px-5 py-4 transition-colors active:bg-slate-50 ${
                  i < group.items.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy/5 text-navy-light">
                    <item.icon size={17} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-charcoal">{item.label}</p>
                    <p className="text-xs text-stone-500">{item.sub}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-stone-300" strokeWidth={1.5} />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <SignOutButton />
    </AppShell>
  )
}

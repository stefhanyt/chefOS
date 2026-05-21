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
        <div className="mb-6 h-32 animate-pulse rounded-[26px] bg-slate-200" />
      ) : profile ? (
        <div className="mb-6 rounded-[26px] bg-gradient-to-br from-[#0F2A55] to-[#2563EB] p-6 text-white shadow-xl shadow-blue-500/20">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl font-extrabold backdrop-blur-sm">
              {initial}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold">{profile.display_name}</h2>
              <p className="text-sm text-blue-200">{profile.email}</p>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-blue-300">
                {profile.role}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && profile && (
        <div className="mb-6 rounded-[22px] border border-[#E6EEF8] bg-white p-5 shadow-md shadow-slate-900/4">
          <h2 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-slate-400">
            Edit Profile
          </h2>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Display Name
          </label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="mb-4 w-full rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            disabled={saving || !editName.trim()}
            onClick={handleSaveProfile}
            className="w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      )}

      {settingsGroups.map((group) => (
        <div key={group.group} className="mb-5">
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
            {group.group}
          </h2>
          <div className="overflow-hidden rounded-[22px] border border-[#E6EEF8] bg-white shadow-md shadow-slate-900/4">
            {group.items.map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center justify-between px-5 py-4 transition-colors active:bg-slate-50 ${
                  i < group.items.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <item.icon size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.sub}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <SignOutButton />
    </AppShell>
  )
}

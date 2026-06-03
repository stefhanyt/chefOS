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
import { Users, Home, Bell, ChevronRight, ChefHat, CalendarDays } from "lucide-react"
import { useHomeAccess } from "@/hooks/useHomeAccess"
import type { Profile } from "@/lib/types"
import ErrorBanner from "@/components/ErrorBanner"
import { CONFIG_ERROR } from "@/lib/constants"
import { ui } from "@/lib/ui"

export default function SettingsPage() {
  const { showSuccess, showError } = useToast()
  const { merged, loading: accessLoading } = useHomeAccess()
  const [profile, setProfile] = useState<Pick<Profile, "display_name" | "email" | "role"> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState("")
  const [retryCount, setRetryCount] = useState(0)

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
  }, [retryCount])

  async function handleSaveProfile() {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    if (!profile) return
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in to save your profile.")
      return
    }

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

  const settingsGroups = [
    {
      group: "Management",
      items: [
        ...(merged.canManageTeam
          ? [
              {
                label: "Team & Access",
                sub: "Manage staff per residence",
                icon: Users,
                href: "/settings/team",
              },
            ]
          : []),
        {
          label: "Homes",
          sub: merged.canAddHome
            ? "Add or edit residences"
            : "View residences",
          icon: Home,
          href: "/homes",
        },
        ...(merged.canViewMenu
          ? [
              {
                label: "Weekly Menu",
                sub: merged.canEditMenu ? "Plan and edit menus" : "View menu",
                icon: CalendarDays,
                href: "/menu",
              },
            ]
          : []),
        ...(merged.canManageDishRepertoire
          ? [
              {
                label: "Dish Repertoire",
                sub: "Reusable dishes, menus & shopping",
                icon: ChefHat,
                href: "/dish-library",
              },
            ]
          : []),
      ],
    },
    {
      group: "App",
      items: [
        {
          label: "Notifications",
          sub: "Coming soon",
          icon: Bell,
          href: "/settings",
          disabled: true,
        },
      ],
    },
  ].filter((g) => g.items.length > 0)

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        subtitle="Profile, residences, and household access"
      />

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => setRetryCount((c) => c + 1)}
        />
      )}

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

      {!accessLoading &&
        settingsGroups.map((group) => (
        <div key={group.group} className="mb-5">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            {group.group}
          </h2>
          <div className={`${ui.cardInset} overflow-hidden`}>
            {group.items.map((item, i) => {
              const rowClass = `flex min-h-[52px] items-center justify-between px-5 py-4 ${
                i < group.items.length - 1 ? "border-b border-slate-100" : ""
              }`
              const inner = (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy/5 text-navy-light">
                      <item.icon size={17} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-charcoal">{item.label}</p>
                      <p className="text-xs text-stone-500">{item.sub}</p>
                    </div>
                  </div>
                  {!("disabled" in item && item.disabled) && (
                    <ChevronRight size={16} className="text-stone-300" strokeWidth={1.5} />
                  )}
                </>
              )
              if ("disabled" in item && item.disabled) {
                return (
                  <div
                    key={item.label}
                    className={`${rowClass} cursor-not-allowed opacity-50`}
                    aria-disabled
                  >
                    {inner}
                  </div>
                )
              }
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`${rowClass} transition-colors active:bg-slate-50`}
                >
                  {inner}
                </Link>
              )
            })}
          </div>
        </div>
        ))}

      <SignOutButton />
    </AppShell>
  )
}

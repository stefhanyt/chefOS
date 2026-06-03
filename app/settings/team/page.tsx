"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import StatusBadge from "@/components/StatusBadge"
import ErrorBanner from "@/components/ErrorBanner"
import EmptyState from "@/components/EmptyState"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { useToast } from "@/components/ToastProvider"
import type { Home, HomeMember, MemberRole } from "@/lib/types"
import { ChevronLeft, Plus, Trash2 } from "lucide-react"
import { ui } from "@/lib/ui"
import SheetModal from "@/components/SheetModal"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"

const CONFIG_ERROR =
  "Database not configured. Add Supabase credentials to .env.local and restart the dev server."

export default function TeamPage() {
  const { showSuccess, showError } = useToast()
  const [homes, setHomes] = useState<Home[]>([])
  const [members, setMembers] = useState<HomeMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteHomeId, setInviteHomeId] = useState("")
  const [inviteRole, setInviteRole] = useState<MemberRole>("staff")
  const [canEditPantry, setCanEditPantry] = useState(true)
  const [canAddShopping, setCanAddShopping] = useState(true)
  const [canLogMeals, setCanLogMeals] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    if (!supabase) {
      setError(CONFIG_ERROR)
      setLoading(false)
      return
    }
    try {
      const [homesRes, membersRes] = await Promise.all([
        supabase.from("homes").select("*").is("archived_at", null).order("name"),
        supabase
          .from("home_members")
          .select("*, profile:profiles(id, display_name, email)")
          .is("removed_at", null)
          .order("created_at"),
      ])
      if (homesRes.error) throw homesRes.error
      setHomes((homesRes.data as Home[]) ?? [])
      setMembers((membersRes.data as HomeMember[]) ?? [])
      if (homesRes.data?.[0]) setInviteHomeId(homesRes.data[0].id)
    } catch (err) {
      logSupabaseError("team load", err)
      setError("Failed to load team data.")
      showError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in.")
      return
    }

    setSaving(true)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", inviteEmail.trim())
      .maybeSingle()

    if (profileError) {
      logSupabaseError("team invite profile lookup", profileError)
      showError(getSupabaseErrorMessage(profileError))
      setSaving(false)
      return
    }

    if (!profile) {
      showError("No user found with that email. They must sign up first.")
      setSaving(false)
      return
    }

    const { data, error } = await supabase
      .from("home_members")
      .insert({
        home_id: inviteHomeId,
        user_id: profile.id,
        role: inviteRole,
        can_edit_pantry: canEditPantry,
        can_add_shopping_items: canAddShopping,
        can_log_meals: canLogMeals,
        invited_by: userId,
      })
      .select("*, profile:profiles(id, display_name, email)")
      .single()

    setSaving(false)

    if (error) {
      logSupabaseError("team invite insert", error)
      showError(getSupabaseErrorMessage(error))
      return
    }

    if (data) setMembers((prev) => [...prev, data as HomeMember])
    setShowInvite(false)
    setInviteEmail("")
    showSuccess("Team member added")
  }

  async function handleRemoveMember(memberId: string) {
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase
      .from("home_members")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", memberId)
    if (error) {
      logSupabaseError("team member remove", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
    showSuccess("Member removed")
  }

  return (
    <AppShell>
      <Link
        href="/settings"
        className="mb-5 flex items-center gap-1.5 text-sm font-semibold text-navy-light"
      >
        <ChevronLeft size={16} />
        Settings
      </Link>

      <PageHeader
        title="Team & Access"
        subtitle={loading ? "Loading…" : "Manage staff per residence"}
        action={
          <button
            onClick={() => setShowInvite(true)}
            disabled={homes.length === 0}
            className={`${ui.btnHeader} disabled:opacity-50`}
          >
            <Plus size={15} />
            Invite
          </button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[22px] bg-slate-200" />
          ))}
        </div>
      ) : homes.length === 0 ? (
        <EmptyState
          title="No residences yet"
          message="Add a home before inviting team members."
          action={
            <Link href="/homes" className={ui.btnPrimary}>
              Add residence
            </Link>
          }
        />
      ) : (
        homes.map((home) => {
          const homeMembers = members.filter((m) => m.home_id === home.id)
          return (
            <div key={home.id} className="mb-6">
              <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
                {home.name} · {home.location}
              </h2>

              {homeMembers.length === 0 ? (
                <div className="rounded-[22px] border border-stone-200/60 bg-white p-4 text-sm text-slate-400">
                  No staff assigned.
                </div>
              ) : (
                <div className="overflow-hidden rounded-[22px] border border-stone-200/60 bg-white shadow-md shadow-slate-900/4">
                  {homeMembers.map((member, i) => (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between px-5 py-4 ${
                        i < homeMembers.length - 1 ? "border-b border-slate-100" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-extrabold text-slate-600">
                          {member.profile?.display_name?.[0] ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {member.profile?.display_name}
                          </p>
                          <p className="text-xs text-slate-400">{member.profile?.email}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {member.can_edit_pantry && <PermChip label="Edit Pantry" />}
                            {member.can_add_shopping_items && <PermChip label="Shopping" />}
                            {member.can_log_meals && <PermChip label="Log Meals" />}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge
                          label={member.role}
                          type={
                            member.role === "admin"
                              ? "blue"
                              : member.role === "staff"
                                ? "ok"
                                : "low"
                          }
                        />
                        {member.role !== "admin" && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-red-400"
                            aria-label="Remove member"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}

      {showInvite && (
        <SheetModal
          open
          onClose={() => setShowInvite(false)}
          title="Invite Staff"
          footer={
            <ModalSubmitFooter
              formId="invite-staff-form"
              label="Add Team Member"
              saving={saving}
              disabled={!inviteEmail.trim() || !inviteHomeId || saving}
              missing={[
                !inviteEmail.trim() && "email",
                !inviteHomeId && "residence",
              ].filter(Boolean) as string[]}
            />
          }
        >
            <form id="invite-staff-form" onSubmit={handleInvite} className="space-y-4">
              <Field
                label="Email Address"
                value={inviteEmail}
                onChange={setInviteEmail}
                placeholder="staff@email.com"
                type="email"
              />

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Residence
                </label>
                <select
                  value={inviteHomeId}
                  onChange={(e) => setInviteHomeId(e.target.value)}
                  className="w-full rounded-2xl border border-stone-200/60 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {homes.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Role
                </label>
                <div className="flex gap-2">
                  {(["staff", "viewer"] as MemberRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      className={`flex-1 rounded-xl border py-2.5 text-xs font-bold capitalize transition-colors ${
                        inviteRole === r
                          ? "border-navy bg-navy text-ivory"
                          : "border-stone-200/60 text-slate-600"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Permissions
                </label>
                <div className="space-y-2">
                  <PermToggle
                    label="Can edit pantry"
                    checked={canEditPantry}
                    onChange={setCanEditPantry}
                  />
                  <PermToggle
                    label="Can add shopping items"
                    checked={canAddShopping}
                    onChange={setCanAddShopping}
                  />
                  <PermToggle
                    label="Can log meals"
                    checked={canLogMeals}
                    onChange={setCanLogMeals}
                  />
                </div>
              </div>

            </form>
        </SheetModal>
      )}
    </AppShell>
  )
}

function PermChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
      {label}
    </span>
  )
}

function PermToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-stone-200/60 px-4 py-3">
      <span className="text-sm text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-blue-600"
      />
    </label>
  )
}

function Field({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string
  placeholder: string
  type?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <input
        type={type}
        required={type === "email"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-stone-200/60 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  )
}

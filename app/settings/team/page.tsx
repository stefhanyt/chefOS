"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import MobileTopBar from "@/components/MobileTopBar"
import PageHeader from "@/components/PageHeader"
import StatusBadge from "@/components/StatusBadge"
import ErrorBanner from "@/components/ErrorBanner"
import EmptyState from "@/components/EmptyState"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { useToast } from "@/components/ToastProvider"
import type { Home, HomeMember, MemberRole, Profile } from "@/lib/types"
import {
  ALL_MEMBER_ROLES,
  INVITE_MEMBER_ROLES,
  ROLE_LABELS,
  flagsForRole,
  resolveResidenceAccess,
} from "@/lib/home-access"
import { Plus, Trash2 } from "lucide-react"
import { ui } from "@/lib/ui"
import SheetModal from "@/components/SheetModal"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import { CONFIG_ERROR } from "@/lib/constants"
import ConfirmModal from "@/components/ConfirmModal"
import { lookupProfileIdForTeamInvite } from "@/lib/supabase/team"

const ACCOUNT_REQUIRED_MSG =
  "This person needs to create a ChefOS account first."

export default function TeamPage() {
  const { showSuccess, showError } = useToast()
  const [userId, setUserId] = useState<string | null>(null)
  const [homes, setHomes] = useState<Home[]>([])
  const [members, setMembers] = useState<HomeMember[]>([])
  const [ownerProfiles, setOwnerProfiles] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteHomeId, setInviteHomeId] = useState("")
  const [inviteRole, setInviteRole] = useState<MemberRole>("staff")
  const [saving, setSaving] = useState(false)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<HomeMember | null>(null)
  const [removing, setRemoving] = useState(false)

  const manageableHomes = useMemo(() => {
    if (!userId) return []
    return homes.filter((h) => {
      const self = members.find(
        (m) => m.home_id === h.id && m.user_id === userId,
      )
      return resolveResidenceAccess(userId, h, self ?? null).canManageTeam
    })
  }, [homes, members, userId])

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
      const uid = await getAuthUserId(supabase)
      setUserId(uid)
      const [homesRes, membersRes] = await Promise.all([
        supabase.from("homes").select("*").is("archived_at", null).order("name"),
        supabase
          .from("home_members")
          .select("*, profile:profiles(id, display_name, email)")
          .is("removed_at", null)
          .order("created_at"),
      ])
      if (homesRes.error) throw homesRes.error
      if (membersRes.error) throw membersRes.error
      const homeList = (homesRes.data as Home[]) ?? []
      setHomes(homeList)
      setMembers((membersRes.data as HomeMember[]) ?? [])

      const ownerIds = Array.from(new Set(homeList.map((h) => h.owner_id)))
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, email, role, created_at, updated_at")
          .in("id", ownerIds)
        const map: Record<string, Profile> = {}
        for (const p of profiles ?? []) {
          map[p.id] = p as Profile
        }
        setOwnerProfiles(map)
      } else {
        setOwnerProfiles({})
      }

      const memberList = (membersRes.data as HomeMember[]) ?? []
      const firstManageable = homeList.find((h) => {
        if (!uid) return false
        const self = memberList.find(
          (m) => m.home_id === h.id && m.user_id === uid,
        )
        return resolveResidenceAccess(uid, h, self ?? null).canManageTeam
      })
      if (firstManageable) setInviteHomeId(firstManageable.id)
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
    const uid = await getAuthUserId(supabase)
    if (!uid) {
      showError("You must be signed in.")
      return
    }

    const home = manageableHomes.find((h) => h.id === inviteHomeId)
    if (!home) {
      showError("You cannot add members to this residence.")
      return
    }

    setSaving(true)
    let profileId: string | null = null
    try {
      profileId = await lookupProfileIdForTeamInvite(
        supabase,
        inviteHomeId,
        inviteEmail,
      )
    } catch (err) {
      logSupabaseError("team invite profile lookup", err)
      showError(getSupabaseErrorMessage(err))
      setSaving(false)
      return
    }

    if (!profileId) {
      showError(ACCOUNT_REQUIRED_MSG)
      setSaving(false)
      return
    }

    if (profileId === home.owner_id) {
      showError("This person already owns this residence.")
      setSaving(false)
      return
    }

    const alreadyMember = members.some(
      (m) => m.home_id === inviteHomeId && m.user_id === profileId,
    )
    if (alreadyMember) {
      showError("This person is already on the team for this residence.")
      setSaving(false)
      return
    }

    const flags = flagsForRole(inviteRole)
    const { data, error } = await supabase
      .from("home_members")
      .insert({
        home_id: inviteHomeId,
        user_id: profileId,
        role: inviteRole,
        ...flags,
        invited_by: uid,
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

  async function handleRoleChange(memberId: string, role: MemberRole) {
    const supabase = createClient()
    if (!supabase) return
    setUpdatingMemberId(memberId)
    const flags = flagsForRole(role)
    const { data, error } = await supabase
      .from("home_members")
      .update({ role, ...flags })
      .eq("id", memberId)
      .select("*, profile:profiles(id, display_name, email)")
      .single()
    setUpdatingMemberId(null)
    if (error) {
      logSupabaseError("team role update", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    if (data) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? (data as HomeMember) : m)),
      )
      showSuccess("Role updated")
    }
  }

  async function confirmRemoveMember() {
    if (!removeTarget) return
    setRemoving(true)
    const supabase = createClient()
    if (!supabase) {
      setRemoving(false)
      return
    }
    const { error } = await supabase
      .from("home_members")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", removeTarget.id)
    setRemoving(false)
    if (error) {
      logSupabaseError("team member remove", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id))
    showSuccess("Member removed")
    setRemoveTarget(null)
  }

  return (
    <AppShell>
      <MobileTopBar backHref="/settings" backLabel="Settings" title="Team & Access" />

      <PageHeader
        subtitle={
          loading
            ? "Loading…"
            : "Add staff by email — each person uses their own login"
        }
        action={
          manageableHomes.length > 0 ? (
            <button
              onClick={() => setShowInvite(true)}
              className={ui.btnHeader}
            >
              <Plus size={15} />
              Invite
            </button>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[22px] bg-slate-200" />
          ))}
        </div>
      ) : manageableHomes.length === 0 ? (
        <EmptyState
          title="No team access"
          message="Only residence owners and admins can manage team members."
          action={
            <Link href="/settings" className={ui.btnPrimary}>
              Back to settings
            </Link>
          }
        />
      ) : (
        manageableHomes.map((home) => {
          const homeMembers = members.filter((m) => m.home_id === home.id)
          const owner = ownerProfiles[home.owner_id]
          return (
            <div key={home.id} className="mb-6">
              <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
                {home.name} · {home.location}
              </h2>

              <div className="overflow-hidden rounded-[22px] border border-stone-200/60 bg-white shadow-md shadow-slate-900/4">
                <MemberRow
                  name={owner?.display_name ?? "Owner"}
                  email={owner?.email ?? ""}
                  roleLabel={ROLE_LABELS.owner}
                  badgeType="blue"
                />
                {homeMembers.length === 0 ? (
                  <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-400">
                    No other staff yet.
                  </div>
                ) : (
                  homeMembers.map((member, i) => (
                    <div
                      key={member.id}
                      className={`flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                        i === homeMembers.length - 1 ? "" : ""
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
                          <p className="text-xs text-slate-400">
                            {member.profile?.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                        <select
                          value={member.role}
                          disabled={updatingMemberId === member.id}
                          onChange={(e) =>
                            handleRoleChange(
                              member.id,
                              e.target.value as MemberRole,
                            )
                          }
                          className="min-h-[44px] rounded-xl border border-stone-200/60 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                          aria-label={`Role for ${member.profile?.display_name}`}
                        >
                          {ALL_MEMBER_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(member)}
                          className="flex h-9 w-9 items-center justify-center text-red-400"
                          aria-label="Remove member"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })
      )}

      <ConfirmModal
        open={Boolean(removeTarget)}
        title="Remove team member?"
        message={
          removeTarget ? (
            <>
              Remove <strong>{removeTarget.profile?.display_name}</strong> from this
              residence? They will lose access on their next login.
            </>
          ) : null
        }
        confirmLabel="Remove"
        destructive
        loading={removing}
        onClose={() => !removing && setRemoveTarget(null)}
        onConfirm={confirmRemoveMember}
      />

      {showInvite && (
        <SheetModal
          open
          onClose={() => setShowInvite(false)}
          title="Add team member"
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
            <p className="text-sm leading-relaxed text-slate-500">
              They must create their own ChefOS account with this email first.
              You are not sharing your login.
            </p>
            <Field
              label="Staff email"
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
                {manageableHomes.map((h) => (
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
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                className="w-full min-h-[44px] rounded-2xl border border-stone-200/60 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {INVITE_MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </SheetModal>
      )}
    </AppShell>
  )
}

function MemberRow({
  name,
  email,
  roleLabel,
  badgeType,
}: {
  name: string
  email: string
  roleLabel: string
  badgeType: "blue" | "ok" | "low"
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-extrabold text-slate-600">
          {name[0] ?? "?"}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{name}</p>
          {email ? (
            <p className="text-xs text-slate-400">{email}</p>
          ) : null}
        </div>
      </div>
      <StatusBadge label={roleLabel} type={badgeType} />
    </div>
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

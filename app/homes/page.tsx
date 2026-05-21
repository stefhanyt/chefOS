"use client"

import { useState, useEffect, useMemo } from "react"
import AppShell from "@/components/AppShell"
import HomeCard from "@/components/HomeCard"
import PageHeader from "@/components/PageHeader"
import SheetModal from "@/components/SheetModal"
import FormField from "@/components/FormField"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { createHomeWithOwner } from "@/lib/supabase/homes"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { useToast } from "@/components/ToastProvider"
import { CONFIG_ERROR } from "@/lib/constants"
import type { Home } from "@/lib/types"
import { Plus } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"

export default function HomesPage() {
  const { showSuccess, showError } = useToast()
  const [homes, setHomes] = useState<Home[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null)
  const [editingHome, setEditingHome] = useState<Home | null>(null)

  async function loadHomes() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    if (!supabase) {
      setError(CONFIG_ERROR)
      setLoading(false)
      return
    }
    try {
      const [homesRes, pantryRes, shoppingRes, mealsRes, membersRes] =
        await Promise.all([
          supabase.from("homes").select("*").is("archived_at", null).order("name"),
          supabase
            .from("pantry_items")
            .select("home_id")
            .in("status", ["Critical", "Out of Stock"])
            .is("archived_at", null),
          supabase
            .from("shopping_items")
            .select("home_id")
            .eq("status", "Open")
            .is("archived_at", null),
          supabase
            .from("prepared_meals")
            .select("home_id")
            .in("status", ["Use Soon", "Expired"])
            .is("archived_at", null),
          supabase.from("home_members").select("home_id").is("removed_at", null),
        ])

      if (homesRes.error) throw homesRes.error

      const count = (arr: { home_id: string }[] | null) =>
        (arr ?? []).reduce<Record<string, number>>((m, r) => {
          m[r.home_id] = (m[r.home_id] ?? 0) + 1
          return m
        }, {})

      const enriched: Home[] = (homesRes.data ?? []).map((h) => ({
        ...h,
        pantry_alert_count: count(pantryRes.data)[h.id] ?? 0,
        open_shopping_count: count(shoppingRes.data)[h.id] ?? 0,
        expiring_meal_count: count(mealsRes.data)[h.id] ?? 0,
        member_count: count(membersRes.data)[h.id] ?? 0,
      }))

      setHomes(enriched)
    } catch (err) {
      logSupabaseError("homes load", err)
      setError("Failed to load residences. Check your connection and try again.")
      showError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHomes()
  }, [retryCount])

  function closeModal() {
    setModalMode(null)
    setEditingHome(null)
  }

  async function handleSaveHome(
    form: { name: string; location: string; notes: string },
    existingId?: string,
  ) {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }

    if (existingId) {
      const { data, error } = await supabase
        .from("homes")
        .update({
          name: form.name,
          location: form.location,
          notes: form.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingId)
        .select("*")
        .single()
      if (error) {
        logSupabaseError("homes update", error)
        showError(getSupabaseErrorMessage(error))
        return
      }
      if (data) {
        setHomes((prev) =>
          prev.map((h) =>
            h.id === existingId
              ? {
                  ...h,
                  ...data,
                  pantry_alert_count: h.pantry_alert_count,
                  open_shopping_count: h.open_shopping_count,
                  expiring_meal_count: h.expiring_meal_count,
                  member_count: h.member_count,
                }
              : h,
          ),
        )
      }
      showSuccess("Residence updated")
      closeModal()
      return
    }

    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in to add a residence.")
      return
    }

    const { home, error: createError } = await createHomeWithOwner(
      supabase,
      userId,
      form,
    )

    if (createError || !home) {
      showError(getSupabaseErrorMessage(createError))
      return
    }

    setHomes((prev) => [
      ...prev,
      {
        ...home,
        pantry_alert_count: 0,
        open_shopping_count: 0,
        expiring_meal_count: 0,
        member_count: 1,
      },
    ])
    showSuccess(`${home.name} added`)
    closeModal()
  }

  async function handleArchiveHome(home: Home) {
    if (!confirm(`Archive "${home.name}"? You can restore it later from the database.`))
      return
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase
      .from("homes")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", home.id)
    if (error) {
      logSupabaseError("homes archive", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    setHomes((prev) => prev.filter((h) => h.id !== home.id))
    showSuccess("Residence archived")
    closeModal()
  }

  return (
    <AppShell>
      <PageHeader
        title="Residences"
        subtitle={loading ? "Loading…" : `${homes.length} home${homes.length !== 1 ? "s" : ""}`}
        action={
          <button
            onClick={() => setModalMode("add")}
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30"
          >
            <Plus size={15} />
            Add Home
          </button>
        }
      />

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-[26px] bg-slate-200"
            />
          ))}
        </div>
      ) : homes.length === 0 ? (
        <div className="rounded-[22px] border border-[#E6EEF8] bg-white p-8 text-center text-sm text-slate-400">
          No residences yet. Add your first home to get started.
        </div>
      ) : (
        homes.map((home) => (
          <HomeCard
            key={home.id}
            home={home}
            onEdit={(h) => {
              setEditingHome(h)
              setModalMode("edit")
            }}
          />
        ))
      )}

      {modalMode && (
        <HomeFormModal
          mode={modalMode}
          home={editingHome}
          onClose={closeModal}
          onSave={handleSaveHome}
          onArchive={modalMode === "edit" ? handleArchiveHome : undefined}
        />
      )}
    </AppShell>
  )
}

function HomeFormModal({
  mode,
  home,
  onClose,
  onSave,
  onArchive,
}: {
  mode: "add" | "edit"
  home: Home | null
  onClose: () => void
  onSave: (
    form: { name: string; location: string; notes: string },
    existingId?: string,
  ) => void | Promise<void>
  onArchive?: (home: Home) => void | Promise<void>
}) {
  const formId = "home-form"
  const [name, setName] = useState(home?.name ?? "")
  const [location, setLocation] = useState(home?.location ?? "")
  const [notes, setNotes] = useState(home?.notes ?? "")
  const [saving, setSaving] = useState(false)

  const validation = useMemo(() => {
    const missing: string[] = []
    if (!name.trim()) missing.push("name")
    if (!location.trim()) missing.push("location")
    return {
      canSubmit: missing.length === 0 && !saving,
      missing,
    }
  }, [name, location, saving])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validation.canSubmit) return
    setSaving(true)
    try {
      await onSave(
        { name: name.trim(), location: location.trim(), notes: notes.trim() },
        home?.id,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetModal
      open
      onClose={onClose}
      title={mode === "edit" ? "Edit Residence" : "Add Residence"}
      footer={
        <div className="space-y-3">
          {mode === "edit" && home && onArchive && (
            <button
              type="button"
              onClick={() => onArchive(home)}
              className="w-full rounded-2xl border border-red-200 py-3 text-sm font-bold text-red-600"
            >
              Archive Residence
            </button>
          )}
          <ModalSubmitFooter
            formId={formId}
            label={mode === "edit" ? "Save Changes" : "Save Residence"}
            saving={saving}
            disabled={!validation.canSubmit}
            missing={validation.missing}
          />
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Name"
          value={name}
          onChange={setName}
          placeholder="e.g. Main House"
          required
        />
        <FormField
          label="Location"
          value={location}
          onChange={setLocation}
          placeholder="e.g. Toronto, ON"
          required
        />
        <FormField
          label="Notes (optional)"
          value={notes}
          onChange={setNotes}
          placeholder="Kitchen details, preferences…"
        />
      </form>
    </SheetModal>
  )
}

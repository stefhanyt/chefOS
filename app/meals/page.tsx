"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import MealCard from "@/components/MealCard"
import SearchAndFilterBar from "@/components/SearchAndFilterBar"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { computeMealStatus } from "@/lib/pantry-utils"
import {
  attachHomes,
  fetchPreparedMeals,
  fetchRowById,
  logClientFilter,
  mergeById,
} from "@/lib/supabase/list-fetch"
import { useToast } from "@/components/ToastProvider"
import type { Home, PreparedMeal, MealStatus } from "@/lib/types"
import { Plus } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"
import EmptyState from "@/components/EmptyState"
import { SkeletonList } from "@/components/Skeleton"
import { ui } from "@/lib/ui"
import SheetModal from "@/components/SheetModal"
import FormField from "@/components/FormField"
import SuggestingInput from "@/components/SuggestingInput"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import { useMealSuggestionHistory } from "@/hooks/useMealSuggestionHistory"
import { CONFIG_ERROR } from "@/lib/constants"

const STATUS_FILTERS: (MealStatus | "All")[] = [
  "All",
  "Fresh",
  "Use Soon",
  "Expired",
]

export default function MealsPage() {
  const { showSuccess, showError } = useToast()
  const [meals, setMeals] = useState<PreparedMeal[]>([])
  const [homes, setHomes] = useState<Home[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<MealStatus | "All">("All")
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null)
  const [editingMeal, setEditingMeal] = useState<PreparedMeal | null>(null)

  const loadMeals = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    const supabase = createClient()
    if (!supabase) {
      setError(CONFIG_ERROR)
      if (!opts?.silent) setLoading(false)
      return
    }
    try {
      const homesRes = await supabase
        .from("homes")
        .select("id, name, location, owner_id")
        .is("archived_at", null)
        .order("name")
      if (homesRes.error) throw homesRes.error
      const homeList = (homesRes.data as Home[]) ?? []
      setHomes(homeList)

      const { data, error: mealsError } = await fetchPreparedMeals(
        supabase,
        homeList,
      )
      if (mealsError) throw mealsError
      setMeals(data)
    } catch (err) {
      logSupabaseError("meals load", err)
      setError("Failed to load meals. Check your connection and try again.")
      showError(getSupabaseErrorMessage(err))
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    loadMeals()
  }, [retryCount, loadMeals])

  const filtered = useMemo(() => {
    const next = meals.filter((m) => {
      const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === "All" || m.status === statusFilter
      return matchSearch && matchStatus
    })
    logClientFilter("prepared_meals", meals.length, next.length, {
      search,
      statusFilter,
    })
    return next
  }, [meals, search, statusFilter])

  const expiring = meals.filter((m) => m.status === "Use Soon").length
  const expired = meals.filter((m) => m.status === "Expired").length

  type MealForm = {
    name: string
    prepared_date: string
    expiry_date: string
    portions: number
    storage_location: string
    reheating_instructions: string
    home_id: string
  }

  async function handleSaveMeal(form: MealForm, existingId?: string) {
    const status = computeMealStatus(form.expiry_date)
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }

    if (existingId) {
      const { error: updateError } = await supabase
        .from("prepared_meals")
        .update({ ...form, status, updated_at: new Date().toISOString() })
        .eq("id", existingId)
      if (updateError) {
        logSupabaseError("meals update", updateError)
        showError(getSupabaseErrorMessage(updateError))
        return
      }
      const row = await fetchRowById<PreparedMeal>(
        supabase,
        "prepared_meals",
        existingId,
      )
      if (row) {
        const normalized = {
          ...row,
          status: computeMealStatus(row.expiry_date),
        }
        const attached = attachHomes([normalized], homes)[0]
        setMeals((prev) =>
          prev.map((m) => (m.id === existingId ? attached : m)),
        )
      }
      await loadMeals({ silent: true })
      showSuccess("Meal updated")
    } else {
      const userId = await getAuthUserId(supabase)
      if (!userId) {
        showError("You must be signed in to log meals.")
        return
      }
      const { data: inserted, error } = await supabase
        .from("prepared_meals")
        .insert({ ...form, status, created_by: userId, notes: "" })
        .select("*")
        .single()
      if (error) {
        logSupabaseError("meals insert", error)
        showError(getSupabaseErrorMessage(error))
        return
      }
      let row = inserted as PreparedMeal | null
      if (!row) {
        const { data: fallback } = await supabase
          .from("prepared_meals")
          .select("*")
          .eq("home_id", form.home_id)
          .eq("name", form.name.trim())
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        row = (fallback as PreparedMeal) ?? null
      }
      if (row) {
        const normalized = {
          ...row,
          status: computeMealStatus(row.expiry_date),
        }
        const attached = attachHomes([normalized], homes)[0]
        setMeals((prev) => mergeById(prev, attached))
      }
      await loadMeals({ silent: true })
      showSuccess("Meal logged")
    }
    setModalMode(null)
    setEditingMeal(null)
  }

  async function handleRemoveMeal(meal: PreparedMeal) {
    if (!confirm(`Remove "${meal.name}" from prepared meals?`)) return
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase
      .from("prepared_meals")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", meal.id)
    if (error) {
      logSupabaseError("meals archive", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    setMeals((prev) => prev.filter((m) => m.id !== meal.id))
    showSuccess("Meal removed")
  }

  return (
    <AppShell>
      <PageHeader
        title="Prepared Meals"
        subtitle={
          loading
            ? "Loading…"
            : `${expiring} use soon · ${expired} expired`
        }
        action={
          <button
            onClick={() => setModalMode("add")}
            className={ui.btnHeader}
          >
            <Plus size={15} />
            Log Meal
          </button>
        }
      />

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      <SearchAndFilterBar
        value={search}
        onChange={setSearch}
        placeholder="Search meals…"
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`transition-colors ${
              statusFilter === s ? ui.chipActive : ui.chip
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={3} className="h-24" />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            search || statusFilter !== "All"
              ? "No meals match your filter."
              : "No prepared meals yet. Log your first dish when it leaves the kitchen."
          }
        />
      ) : (
        filtered.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            onEdit={(m) => {
              setEditingMeal(m)
              setModalMode("edit")
            }}
            onRemove={handleRemoveMeal}
          />
        ))
      )}

      {modalMode && (
        <LogMealForm
          mode={modalMode}
          meal={editingMeal}
          homes={homes}
          onSave={handleSaveMeal}
          onClose={() => {
            setModalMode(null)
            setEditingMeal(null)
          }}
        />
      )}
    </AppShell>
  )
}

function isExpiryOnOrAfterPrep(prep: string, expiry: string): boolean {
  if (!prep || !expiry) return true
  return expiry >= prep
}

function LogMealForm({
  mode,
  meal,
  homes,
  onSave,
  onClose,
}: {
  mode: "add" | "edit"
  meal: PreparedMeal | null
  homes: Home[]
  onSave: (
    form: {
      name: string
      prepared_date: string
      expiry_date: string
      portions: number
      storage_location: string
      reheating_instructions: string
      home_id: string
    },
    existingId?: string,
  ) => void | Promise<void>
  onClose: () => void
}) {
  const formId = "log-meal-form"
  const today = new Date().toISOString().split("T")[0]
  const [name, setName] = useState(meal?.name ?? "")
  const [prepDate, setPrepDate] = useState(meal?.prepared_date ?? today)
  const [expiryDate, setExpiryDate] = useState(meal?.expiry_date ?? "")
  const [portions, setPortions] = useState(String(meal?.portions ?? 2))
  const [storageLocation, setStorageLocation] = useState(meal?.storage_location ?? "")
  const [reheating, setReheating] = useState(meal?.reheating_instructions ?? "")
  const [homeId, setHomeId] = useState(meal?.home_id ?? "")
  const [saving, setSaving] = useState(false)
  const [autofillHint, setAutofillHint] = useState<string | null>(null)

  useEffect(() => {
    if (homes.length === 0) {
      setHomeId("")
      return
    }
    setHomeId((current) => {
      if (current && homes.some((h) => h.id === current)) return current
      return homes[0].id
    })
  }, [homes])

  const resolvedHomeId =
    homes.length === 1 ? homes[0].id : homeId
  const history = useMealSuggestionHistory(resolvedHomeId)

  const nameSuggestions = useMemo(
    () =>
      history.filter(name).map((s) => ({
        id: s.name,
        label: s.name,
        sublabel: [
          s.storage_location,
          s.reheating_instructions,
          s.count > 1 ? `Logged ${s.count}×` : null,
          s.shelf_life_days != null ? `~${s.shelf_life_days} day shelf life` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [history, name],
  )

  const validation = useMemo(() => {
    const hasName = name.trim().length > 0
    const hasExpiry = expiryDate.length > 0
    const hasPrep = prepDate.length > 0
    const hasHome = homeId.length > 0 && homes.some((h) => h.id === homeId)
    const portionsNum = Number(portions)
    const hasPortions = portions.trim() !== "" && !Number.isNaN(portionsNum) && portionsNum > 0
    const datesValid = isExpiryOnOrAfterPrep(prepDate, expiryDate)

    return {
      hasName,
      hasExpiry,
      hasPrep,
      hasHome,
      hasPortions,
      datesValid,
      canSubmit:
        hasName &&
        hasExpiry &&
        hasPrep &&
        hasHome &&
        hasPortions &&
        datesValid &&
        homes.length > 0 &&
        !saving,
      missing: [
        !hasName && "meal name",
        !hasExpiry && "expiry date",
        !hasPrep && "prepared date",
        !hasHome && "residence",
        !hasPortions && "portions (must be > 0)",
        hasPrep && hasExpiry && !datesValid && "expiry must be on or after prepared date",
        homes.length === 0 && "at least one residence (add a home first)",
      ].filter(Boolean) as string[],
    }
  }, [name, expiryDate, prepDate, homeId, portions, homes, saving])

  function applyMealSuggestion(suggestionName: string) {
    const picked = history.suggestions.find(
      (s) => s.name.toLowerCase() === suggestionName.toLowerCase(),
    )

    if (!picked) {
      const profile = history.profileForName(suggestionName)
      if (!profile) {
        setName(suggestionName)
        return
      }
      setName(suggestionName)
      if (profile.storage_location) setStorageLocation(profile.storage_location)
      if (profile.reheating_instructions) setReheating(profile.reheating_instructions)
      if (profile.portions) setPortions(String(profile.portions))
      if (profile.shelf_life_days != null) {
        const d = new Date()
        d.setDate(d.getDate() + profile.shelf_life_days)
        setExpiryDate(d.toISOString().split("T")[0])
      }
      setAutofillHint("Filled from meal & dish history")
      return
    }

    const resolved = history.pickSuggestion(picked)
    setName(resolved.name)
    if (resolved.storage_location) setStorageLocation(resolved.storage_location)
    if (resolved.reheating_instructions) setReheating(resolved.reheating_instructions)
    if (resolved.portions) setPortions(resolved.portions)
    if (resolved.prepared_date) setPrepDate(resolved.prepared_date)
    if (resolved.expiry_date) setExpiryDate(resolved.expiry_date)
    setAutofillHint("Filled from meal & dish history")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validation.canSubmit) return

    setSaving(true)
    try {
      await onSave(
        {
          name: name.trim(),
          prepared_date: prepDate,
          expiry_date: expiryDate,
          portions: Number(portions) || 1,
          storage_location: storageLocation.trim(),
          reheating_instructions: reheating.trim(),
          home_id: homeId,
        },
        meal?.id,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetModal
      open
      onClose={onClose}
      title={mode === "edit" ? "Edit Meal" : "Log Meal"}
      footer={
        <ModalSubmitFooter
          formId={formId}
          label={mode === "edit" ? "Save Changes" : "Save Meal"}
          saving={saving}
          disabled={!validation.canSubmit}
          missing={validation.missing}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {homes.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Add a residence under Settings → Homes before logging meals.
          </p>
        ) : (
          <div>
            <label className="chef-label">Residence</label>
            {homes.length === 1 ? (
              <p className="rounded-xl border border-stone-200/80 bg-stone-50/50 px-4 py-3 text-sm font-medium text-charcoal">
                {homes[0].name}
              </p>
            ) : (
              <select
                required
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                className="chef-input"
              >
                {homes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <SuggestingInput
          label="Meal Name"
          value={name}
          onChange={(v) => {
            setName(v)
            setAutofillHint(null)
          }}
          onSelect={(opt) => applyMealSuggestion(opt.label)}
          suggestions={nameSuggestions}
          placeholder="e.g. Chicken Soup — type to search history"
          required
          hint={autofillHint}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Prepared Date"
            value={prepDate}
            onChange={setPrepDate}
            type="date"
            required
          />
          <FormField
            label="Expiry Date"
            value={expiryDate}
            onChange={setExpiryDate}
            type="date"
            required
            min={prepDate || undefined}
          />
        </div>
        <FormField
          label="Portions"
          value={portions}
          onChange={setPortions}
          placeholder="e.g. 4"
          type="number"
          required
          min={1}
        />
        <FormField
          label="Storage Location"
          value={storageLocation}
          onChange={setStorageLocation}
          placeholder="e.g. Main Fridge"
        />
        <FormField
          label="Reheating Instructions"
          value={reheating}
          onChange={setReheating}
          placeholder="e.g. Stove, medium heat"
        />
      </form>
    </SheetModal>
  )
}

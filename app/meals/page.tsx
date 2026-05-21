"use client"

import { useState, useEffect, useMemo } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import MealCard from "@/components/MealCard"
import SearchAndFilterBar from "@/components/SearchAndFilterBar"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { computeMealStatus } from "@/lib/pantry-utils"
import { useToast } from "@/components/ToastProvider"
import type { Home, PreparedMeal, MealStatus } from "@/lib/types"
import { Plus } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"
import SheetModal from "@/components/SheetModal"
import FormField from "@/components/FormField"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
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

  useEffect(() => {
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
        const [mealsRes, homesRes] = await Promise.all([
          supabase
            .from("prepared_meals")
            .select("*, home:homes(id, name, location)")
            .is("archived_at", null)
            .order("expiry_date"),
          supabase
            .from("homes")
            .select("id, name")
            .is("archived_at", null)
            .order("name"),
        ])
        if (mealsRes.error) throw mealsRes.error
        setMeals((mealsRes.data as PreparedMeal[]) ?? [])
        setHomes((homesRes.data as Home[]) ?? [])
      } catch (err) {
        logSupabaseError("meals load", err)
        setError("Failed to load meals. Check your connection and try again.")
        showError(getSupabaseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount, showError])

  const filtered = meals.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "All" || m.status === statusFilter
    return matchSearch && matchStatus
  })

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
      const { data, error } = await supabase
        .from("prepared_meals")
        .update({ ...form, status, updated_at: new Date().toISOString() })
        .eq("id", existingId)
        .select("*, home:homes(id, name, location)")
        .single()
      if (error) {
        logSupabaseError("meals update", error)
        showError(getSupabaseErrorMessage(error))
        return
      }
      if (data) {
        setMeals((prev) =>
          prev.map((m) => (m.id === existingId ? (data as PreparedMeal) : m)),
        )
      }
      showSuccess("Meal updated")
    } else {
      const userId = await getAuthUserId(supabase)
      if (!userId) {
        showError("You must be signed in to log meals.")
        return
      }
      const { data, error } = await supabase
        .from("prepared_meals")
        .insert({ ...form, status, created_by: userId, notes: "" })
        .select("*, home:homes(id, name, location)")
        .single()
      if (error) {
        logSupabaseError("meals insert", error)
        showError(getSupabaseErrorMessage(error))
        return
      }
      if (data) setMeals((prev) => [data as PreparedMeal, ...prev])
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
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30"
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
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              statusFilter === s
                ? "bg-blue-600 text-white"
                : "border border-[#E6EEF8] bg-white text-slate-500"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[22px] bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[22px] border border-[#E6EEF8] bg-white p-8 text-center text-sm text-slate-400">
          {search || statusFilter !== "All"
            ? "No meals match your filter."
            : "No meals logged yet. Log your first meal!"}
        </div>
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

  // Sync residence when homes load or modal opens (initial useState(homes[0]) was often "")
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
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Residence
            </label>
            {homes.length === 1 ? (
              <p className="rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                {homes[0].name}
              </p>
            ) : (
              <select
                required
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                className="w-full rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
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

        <FormField
          label="Meal Name"
          value={name}
          onChange={setName}
          placeholder="e.g. Chicken Soup"
          required
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

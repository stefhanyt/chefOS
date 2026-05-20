"use client"

import { useState, useEffect } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import MealCard from "@/components/MealCard"
import SearchAndFilterBar from "@/components/SearchAndFilterBar"
import { mockMeals, mockHomes } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import type { Home, PreparedMeal, MealStatus } from "@/lib/types"
import { Plus, X } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"

const STATUS_FILTERS: (MealStatus | "All")[] = [
  "All",
  "Fresh",
  "Use Soon",
  "Expired",
]

export default function MealsPage() {
  const [meals, setMeals] = useState<PreparedMeal[]>([])
  const [homes, setHomes] = useState<Home[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<MealStatus | "All">("All")
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      if (!supabase) {
        setMeals(mockMeals)
        setHomes(mockHomes)
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
      } catch {
        setError("Failed to load meals. Check your connection and try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount])

  const filtered = meals.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "All" || m.status === statusFilter
    return matchSearch && matchStatus
  })

  const expiring = meals.filter((m) => m.status === "Use Soon").length
  const expired = meals.filter((m) => m.status === "Expired").length

  async function handleLogMeal(form: {
    name: string
    prepared_date: string
    expiry_date: string
    portions: number
    storage_location: string
    reheating_instructions: string
    home_id: string
  }) {
    const today = new Date()
    const expiry = new Date(form.expiry_date)
    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
    const status: MealStatus =
      daysUntilExpiry < 0
        ? "Expired"
        : daysUntilExpiry <= 2
          ? "Use Soon"
          : "Fresh"

    const supabase = createClient()
    if (!supabase) {
      const newMeal: PreparedMeal = {
        id: crypto.randomUUID(),
        created_by: "local",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status,
        notes: "",
        ...form,
      }
      setMeals((prev) => [newMeal, ...prev])
      setShowModal(false)
      return
    }
    const { data, error } = await supabase
      .from("prepared_meals")
      .insert({ ...form, status })
      .select("*, home:homes(id, name, location)")
      .single()
    if (!error && data) setMeals((prev) => [data as PreparedMeal, ...prev])
    setShowModal(false)
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
            onClick={() => setShowModal(true)}
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
        filtered.map((meal) => <MealCard key={meal.id} meal={meal} />)
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-y-auto rounded-t-[32px] bg-white px-6 pb-10 pt-6 shadow-2xl max-h-[90vh]">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">Log Meal</h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <LogMealForm
              homes={homes}
              onSave={handleLogMeal}
              onClose={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </AppShell>
  )
}

function LogMealForm({
  homes,
  onSave,
  onClose,
}: {
  homes: Home[]
  onSave: (form: {
    name: string
    prepared_date: string
    expiry_date: string
    portions: number
    storage_location: string
    reheating_instructions: string
    home_id: string
  }) => void
  onClose: () => void
}) {
  const today = new Date().toISOString().split("T")[0]
  const [name, setName] = useState("")
  const [prepDate, setPrepDate] = useState(today)
  const [expiryDate, setExpiryDate] = useState("")
  const [portions, setPortions] = useState("2")
  const [storageLocation, setStorageLocation] = useState("")
  const [reheating, setReheating] = useState("")
  const [homeId, setHomeId] = useState(homes[0]?.id ?? "")

  return (
    <div className="space-y-4">
      {homes.length > 1 && (
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Residence
          </label>
          <select
            value={homeId}
            onChange={(e) => setHomeId(e.target.value)}
            className="w-full rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <FormField label="Meal Name" value={name} onChange={setName} placeholder="e.g. Chicken Soup" />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Prepared Date" value={prepDate} onChange={setPrepDate} type="date" />
        <FormField label="Expiry Date" value={expiryDate} onChange={setExpiryDate} type="date" />
      </div>
      <FormField label="Portions" value={portions} onChange={setPortions} placeholder="e.g. 4" type="number" />
      <FormField label="Storage Location" value={storageLocation} onChange={setStorageLocation} placeholder="e.g. Main Fridge" />
      <FormField label="Reheating Instructions" value={reheating} onChange={setReheating} placeholder="e.g. Stove, medium heat" />
      <button
        disabled={!name.trim() || !expiryDate || !homeId}
        onClick={() =>
          onSave({
            name: name.trim(),
            prepared_date: prepDate,
            expiry_date: expiryDate,
            portions: Number(portions) || 1,
            storage_location: storageLocation.trim(),
            reheating_instructions: reheating.trim(),
            home_id: homeId,
          })
        }
        className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30 disabled:opacity-50"
      >
        Save Meal
      </button>
    </div>
  )
}

function FormField({
  label,
  placeholder = "",
  type = "text",
  value,
  onChange,
}: {
  label: string
  placeholder?: string
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
        inputMode={type === "number" ? "numeric" : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  )
}

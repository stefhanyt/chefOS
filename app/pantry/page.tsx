"use client"

import { useState, useEffect, useMemo } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import PantryItemCard from "@/components/PantryItemCard"
import SearchAndFilterBar from "@/components/SearchAndFilterBar"
import SheetModal from "@/components/SheetModal"
import FormField from "@/components/FormField"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { computePantryStatus } from "@/lib/pantry-utils"
import { useToast } from "@/components/ToastProvider"
import { CONFIG_ERROR } from "@/lib/constants"
import type { Home, PantryItem, PantryStatus } from "@/lib/types"
import { Plus } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"

const STATUS_FILTERS: (PantryStatus | "All")[] = [
  "All",
  "Critical",
  "Out of Stock",
  "Low",
  "OK",
]

type PantryForm = {
  name: string
  quantity: number
  unit: string
  category: string
  storage_location: string
  minimum_quantity: number
  home_id: string
}

export default function PantryPage() {
  const { showSuccess, showError } = useToast()
  const [items, setItems] = useState<PantryItem[]>([])
  const [homes, setHomes] = useState<Home[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<PantryStatus | "All">("All")
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null)
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null)

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
      const [itemsRes, homesRes] = await Promise.all([
        supabase
          .from("pantry_items")
          .select("*, home:homes(id, name, location)")
          .is("archived_at", null)
          .order("status")
          .order("name"),
        supabase.from("homes").select("id, name").is("archived_at", null).order("name"),
      ])
      if (itemsRes.error) throw itemsRes.error
      setItems((itemsRes.data as PantryItem[]) ?? [])
      setHomes((homesRes.data as Home[]) ?? [])
    } catch (err) {
      logSupabaseError("pantry load", err)
      setError("Failed to load pantry.")
      showError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [retryCount])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    const channel = supabase
      .channel("pantry-items-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pantry_items" },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filtered = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "All" || item.status === statusFilter
    return matchSearch && matchStatus
  })

  async function handleQuantityChange(id: string, delta: number) {
    const item = items.find((i) => i.id === id)
    if (!item) return
    const newQty = Math.max(0, item.quantity + delta)
    const status = computePantryStatus(newQty, item.minimum_quantity)
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: newQty, status } : i)),
    )
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase
      .from("pantry_items")
      .update({ quantity: newQty, status, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) {
      logSupabaseError("pantry quantity update", error)
      showError(getSupabaseErrorMessage(error))
      setItems((prev) => prev.map((i) => (i.id === id ? item : i)))
    }
  }

  async function saveItem(form: PantryForm, existingId?: string) {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const status = computePantryStatus(form.quantity, form.minimum_quantity)
    const payload = {
      ...form,
      status,
      updated_at: new Date().toISOString(),
    }

    if (existingId) {
      const { data, error } = await supabase
        .from("pantry_items")
        .update(payload)
        .eq("id", existingId)
        .select("*, home:homes(id, name, location)")
        .single()
      if (error) {
        logSupabaseError("pantry update", error)
        showError(getSupabaseErrorMessage(error))
        return
      }
      if (data) {
        setItems((prev) =>
          prev.map((i) => (i.id === existingId ? (data as PantryItem) : i)),
        )
      }
      showSuccess("Pantry item updated")
    } else {
      const userId = await getAuthUserId(supabase)
      if (!userId) {
        showError("You must be signed in.")
        return
      }
      const { data, error } = await supabase
        .from("pantry_items")
        .insert({ ...payload, created_by: userId })
        .select("*, home:homes(id, name, location)")
        .single()
      if (error) {
        logSupabaseError("pantry insert", error)
        showError(getSupabaseErrorMessage(error))
        return
      }
      if (data) setItems((prev) => [data as PantryItem, ...prev])
      showSuccess("Pantry item added")
    }
    closeModal()
  }

  async function handleRemove(item: PantryItem) {
    if (!confirm(`Remove "${item.name}" from pantry?`)) return
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase
      .from("pantry_items")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", item.id)
    if (error) {
      logSupabaseError("pantry archive", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    showSuccess("Item removed")
  }

  function closeModal() {
    setModalMode(null)
    setEditingItem(null)
  }

  const alertCount = items.filter(
    (i) => i.status === "Critical" || i.status === "Out of Stock",
  ).length

  return (
    <AppShell>
      <PageHeader
        title="Pantry"
        subtitle={
          loading
            ? "Loading…"
            : `${items.length} items${alertCount > 0 ? ` · ${alertCount} alerts` : ""}`
        }
        action={
          <button
            onClick={() => setModalMode("add")}
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30"
          >
            <Plus size={15} />
            Add
          </button>
        }
      />

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      <SearchAndFilterBar value={search} onChange={setSearch} placeholder="Search pantry…" />

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
            <div key={i} className="h-20 animate-pulse rounded-[22px] bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[22px] border border-[#E6EEF8] bg-white p-8 text-center text-sm text-slate-400">
          {search || statusFilter !== "All"
            ? "No items match your search."
            : "Pantry is empty. Add your first item!"}
        </div>
      ) : (
        filtered.map((item) => (
          <PantryItemCard
            key={item.id}
            item={item}
            onQuantityChange={handleQuantityChange}
            onEdit={(i) => {
              setEditingItem(i)
              setModalMode("edit")
            }}
            onRemove={handleRemove}
          />
        ))
      )}

      {modalMode && (
        <PantryItemFormModal
          mode={modalMode}
          homes={homes}
          item={editingItem}
          onClose={closeModal}
          onSave={saveItem}
        />
      )}
    </AppShell>
  )
}

function PantryItemFormModal({
  mode,
  homes,
  item,
  onClose,
  onSave,
}: {
  mode: "add" | "edit"
  homes: Home[]
  item: PantryItem | null
  onClose: () => void
  onSave: (form: PantryForm, existingId?: string) => void | Promise<void>
}) {
  const formId = "pantry-item-form"
  const [name, setName] = useState(item?.name ?? "")
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 0))
  const [unit, setUnit] = useState(item?.unit ?? "")
  const [category, setCategory] = useState(item?.category ?? "")
  const [storageLocation, setStorageLocation] = useState(item?.storage_location ?? "")
  const [minQty, setMinQty] = useState(String(item?.minimum_quantity ?? 0))
  const [homeId, setHomeId] = useState(item?.home_id ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (homes.length > 0 && !homeId) setHomeId(homes[0].id)
  }, [homes, homeId])

  const validation = useMemo(() => {
    const missing: string[] = []
    if (!name.trim()) missing.push("item name")
    if (!homeId) missing.push("residence")
    if (homes.length === 0) missing.push("add a residence first")
    return {
      canSubmit: missing.length === 0 && !saving,
      missing,
    }
  }, [name, homeId, homes.length, saving])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validation.canSubmit) return
    setSaving(true)
    try {
      await onSave(
        {
          name: name.trim(),
          quantity: Number(quantity) || 0,
          unit: unit.trim(),
          category: category.trim(),
          storage_location: storageLocation.trim(),
          minimum_quantity: Number(minQty) || 0,
          home_id: homeId,
        },
        item?.id,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetModal
      open
      onClose={onClose}
      title={mode === "edit" ? "Edit Pantry Item" : "Add Pantry Item"}
      footer={
        <ModalSubmitFooter
          formId={formId}
          label={mode === "edit" ? "Save Changes" : "Save Item"}
          saving={saving}
          disabled={!validation.canSubmit}
          missing={validation.missing}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {homes.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Add a residence under Settings → Homes first.
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
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                className="w-full rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-base text-slate-900"
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
        <FormField label="Item Name" value={name} onChange={setName} placeholder="e.g. Organic Eggs" required />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quantity" value={quantity} onChange={setQuantity} type="number" />
          <FormField label="Unit" value={unit} onChange={setUnit} placeholder="e.g. dozen" />
        </div>
        <FormField label="Category" value={category} onChange={setCategory} placeholder="e.g. Dairy" />
        <FormField label="Storage Location" value={storageLocation} onChange={setStorageLocation} placeholder="e.g. Fridge" />
        <FormField label="Min Quantity" value={minQty} onChange={setMinQty} type="number" />
      </form>
    </SheetModal>
  )
}

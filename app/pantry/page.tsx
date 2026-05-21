"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import PantryItemCard from "@/components/PantryItemCard"
import SearchAndFilterBar from "@/components/SearchAndFilterBar"
import SheetModal from "@/components/SheetModal"
import FormField from "@/components/FormField"
import SuggestingInput from "@/components/SuggestingInput"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import { usePantrySuggestionHistory } from "@/hooks/usePantrySuggestionHistory"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import {
  insertPantryItem,
  updatePantryItem,
  type PantryItemInput,
} from "@/lib/supabase/pantry"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { computePantryStatus } from "@/lib/pantry-utils"
import { useToast } from "@/components/ToastProvider"
import { CONFIG_ERROR } from "@/lib/constants"
import type { Home, PantryItem, PantryStatus } from "@/lib/types"
import { Plus } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"
import EmptyState from "@/components/EmptyState"
import { SkeletonList } from "@/components/Skeleton"
import { ui } from "@/lib/ui"

const STATUS_FILTERS: (PantryStatus | "All")[] = [
  "All",
  "Critical",
  "Out of Stock",
  "Low",
  "OK",
]

const PANTRY_SELECT = "*, home:homes(id, name, location)"

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

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
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
          .select(PANTRY_SELECT)
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
  // showError is stable (memoized in ToastProvider)
  }, [])

  useEffect(() => {
    load()
  }, [retryCount, load])

  const filtered = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.category ?? "").toLowerCase().includes(search.toLowerCase())
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

  async function saveItem(
    form: PantryItemInput,
    existingId?: string,
  ): Promise<boolean> {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return false
    }

    if (!form.home_id) {
      showError("Select a residence before saving.")
      return false
    }

    if (!form.name.trim()) {
      showError("Item name is required.")
      return false
    }

    if (existingId) {
      const { data, error } = await updatePantryItem(supabase, existingId, form)
      if (error) {
        logSupabaseError("pantry update", error)
        showError(getSupabaseErrorMessage(error))
        return false
      }
      if (data) {
        setItems((prev) =>
          prev.map((i) => (i.id === existingId ? data : i)),
        )
      }
      showSuccess("Pantry item updated")
      return true
    }

    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in.")
      return false
    }

    const { data, error } = await insertPantryItem(supabase, form, userId)
    if (error || !data) {
      logSupabaseError("pantry insert", error)
      showError(
        getSupabaseErrorMessage(error) ||
          "Could not add pantry item. Check Supabase permissions (pantry insert / RLS).",
      )
      return false
    }

    setItems((prev) => {
      if (prev.some((i) => i.id === data.id)) return prev
      return [data, ...prev]
    })
    showSuccess("Pantry item added")
    return true
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
            type="button"
            onClick={() => setModalMode("add")}
            className={ui.btnHeader}
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
            type="button"
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
        <SkeletonList count={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            search || statusFilter !== "All"
              ? "No items match your search."
              : "Pantry is empty. Add your first item to begin tracking stock."
          }
        />
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
          key={modalMode === "edit" && editingItem ? editingItem.id : "add"}
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

function resolveHomeId(homes: Home[], selectedId: string): string {
  if (homes.length === 1) return homes[0].id
  return selectedId
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
  onSave: (form: PantryItemInput, existingId?: string) => Promise<boolean>
}) {
  const formId = "pantry-item-form"
  const defaultHomeId =
    item?.home_id ?? (homes.length === 1 ? homes[0]?.id ?? "" : homes[0]?.id ?? "")

  const [name, setName] = useState(item?.name ?? "")
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1))
  const [unit, setUnit] = useState(item?.unit ?? "")
  const [category, setCategory] = useState(item?.category ?? "")
  const [storageLocation, setStorageLocation] = useState(item?.storage_location ?? "")
  const [minQty, setMinQty] = useState(String(item?.minimum_quantity ?? 0))
  const [homeId, setHomeId] = useState(defaultHomeId)
  const [saving, setSaving] = useState(false)
  const [autofillHint, setAutofillHint] = useState<string | null>(null)

  useEffect(() => {
    if (homes.length > 0) {
      setHomeId((current) => {
        if (current && homes.some((h) => h.id === current)) return current
        return homes[0].id
      })
    }
  }, [homes])

  const resolvedHomeId = resolveHomeId(homes, homeId)
  const history = usePantrySuggestionHistory(resolvedHomeId)

  const nameSuggestions = useMemo(
    () =>
      history.filter(name).map((s) => ({
        id: s.name,
        label: s.name,
        sublabel: [
          s.storage_location,
          s.unit,
          s.count > 1 ? `Used ${s.count}×` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [history, name],
  )

  const validation = useMemo(() => {
    const missing: string[] = []
    if (!name.trim()) missing.push("item name")
    if (!resolvedHomeId) missing.push("residence")
    if (homes.length === 0) missing.push("add a residence first")
    return {
      canSubmit: missing.length === 0 && !saving,
      missing,
    }
  }, [name, resolvedHomeId, homes.length, saving])

  function applyPantrySuggestion(suggestionName: string) {
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
      if (profile.unit) setUnit(profile.unit)
      if (profile.category) setCategory(profile.category)
      if (profile.storage_location) setStorageLocation(profile.storage_location)
      if (profile.minimum_quantity > 0) {
        setMinQty(String(profile.minimum_quantity))
      }
      setAutofillHint("Filled from your pantry history")
      return
    }

    const resolved = history.pickSuggestion(picked)
    setName(resolved.name)
    if (resolved.unit) setUnit(resolved.unit)
    if (resolved.category) setCategory(resolved.category)
    if (resolved.storage_location) setStorageLocation(resolved.storage_location)
    if (resolved.minimum_quantity > 0) {
      setMinQty(String(resolved.minimum_quantity))
    }
    setAutofillHint("Filled from your pantry history")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validation.canSubmit) return
    setSaving(true)
    try {
      const ok = await onSave(
        {
          name: name.trim(),
          quantity: Number(quantity) || 0,
          unit: unit.trim(),
          category: category.trim(),
          storage_location: storageLocation.trim(),
          minimum_quantity: Number(minQty) || 0,
          home_id: resolvedHomeId,
        },
        item?.id,
      )
      if (ok) onClose()
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
            Add a residence under Homes first, then return here to add pantry items.
          </p>
        ) : (
          <div>
            <label className="chef-label">Residence</label>
            {homes.length === 1 ? (
              <>
                <p className="rounded-xl border border-stone-200/80 bg-stone-50/50 px-4 py-3 text-sm font-medium text-charcoal">
                  {homes[0].name}
                </p>
                <input type="hidden" name="home_id" value={homes[0].id} />
              </>
            ) : (
              <select
                name="home_id"
                required
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                className="chef-input"
              >
                <option value="" disabled>
                  Select residence…
                </option>
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
          label="Item Name"
          value={name}
          onChange={(v) => {
            setName(v)
            setAutofillHint(null)
          }}
          onSelect={(opt) => applyPantrySuggestion(opt.label)}
          suggestions={nameSuggestions}
          placeholder="e.g. Organic Eggs — type to search history"
          required
          hint={autofillHint}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quantity" value={quantity} onChange={setQuantity} type="number" />
          <FormField label="Unit" value={unit} onChange={setUnit} placeholder="e.g. dozen" />
        </div>
        <FormField label="Category" value={category} onChange={setCategory} placeholder="e.g. Dairy" />
        <FormField
          label="Storage Location"
          value={storageLocation}
          onChange={setStorageLocation}
          placeholder="e.g. Fridge"
        />
        <FormField label="Min Quantity" value={minQty} onChange={setMinQty} type="number" />
      </form>
    </SheetModal>
  )
}

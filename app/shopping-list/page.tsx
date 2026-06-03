"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import ShoppingItemCard from "@/components/ShoppingItemCard"
import SheetModal from "@/components/SheetModal"
import FormField from "@/components/FormField"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { computePantryStatus } from "@/lib/pantry-utils"
import {
  attachHomes,
  fetchShoppingItemById,
  fetchShoppingItems,
  mergeById,
} from "@/lib/supabase/list-fetch"
import { useToast } from "@/components/ToastProvider"
import { CONFIG_ERROR } from "@/lib/constants"
import type { Home, ShoppingItem, Priority } from "@/lib/types"
import { Plus, Check } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"
import EmptyState from "@/components/EmptyState"
import NoHomesBanner from "@/components/NoHomesBanner"
import { SkeletonList } from "@/components/Skeleton"
import { ui } from "@/lib/ui"

export default function ShoppingListPage() {
  const { showSuccess, showError } = useToast()
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [homes, setHomes] = useState<Home[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [purchaseItem, setPurchaseItem] = useState<ShoppingItem | null>(null)
  const [newQty, setNewQty] = useState("")

  const loadItems = useCallback(
    async (opts?: { silent?: boolean }) => {
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
        const homesRes = await supabase
          .from("homes")
          .select("id, name, location, owner_id")
          .is("archived_at", null)
          .order("name")
        if (homesRes.error) throw homesRes.error
        const homeList = (homesRes.data as Home[]) ?? []
        setHomes(homeList)

        const { data, error: itemsError } = await fetchShoppingItems(
          supabase,
          homeList,
        )
        if (itemsError) throw itemsError
        setItems(data)
      } catch (err) {
        logSupabaseError("shopping load", err)
        setError("Failed to load shopping list. Check your connection and try again.")
        showError(getSupabaseErrorMessage(err))
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [showError],
  )

  useEffect(() => {
    loadItems()
  }, [retryCount, loadItems])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    const channel = supabase
      .channel("shopping-items-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shopping_items" },
        async (payload) => {
          const id = (payload.new as { id: string }).id
          const row = await fetchShoppingItemById(supabase, id, homes)
          if (!row) return
          setItems((prev) => mergeById(prev, row))
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shopping_items" },
        async (payload) => {
          const updated = payload.new as ShoppingItem
          if (updated.archived_at || !["Open", "Purchased"].includes(updated.status)) {
            setItems((prev) => prev.filter((i) => i.id !== updated.id))
            return
          }
          const row = await fetchShoppingItemById(supabase, updated.id, homes)
          if (row) {
            setItems((prev) =>
              prev.map((i) => (i.id === updated.id ? row : i))
            )
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "shopping_items" },
        (payload) => {
          setItems((prev) => prev.filter((i) => i.id !== (payload.old as any).id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [homes])

  const open = items.filter((i) => i.status === "Open")
  const purchased = items.filter((i) => i.status === "Purchased")

  function handlePurchase(id: string) {
    const item = items.find((i) => i.id === id)
    if (item) setPurchaseItem(item)
  }

  async function confirmPurchase(updatePantry: boolean) {
    if (!purchaseItem) return

    const now = new Date().toISOString()
    const previousItem = purchaseItem
    setItems((prev) =>
      prev.map((i) =>
        i.id === purchaseItem.id
          ? { ...i, status: "Purchased", completed_at: now }
          : i
      )
    )

    const supabase = createClient()
    if (!supabase) {
      setItems((prev) =>
        prev.map((i) => (i.id === previousItem.id ? previousItem : i)),
      )
      showError(CONFIG_ERROR)
      return
    }

    const { error: shopError } = await supabase
      .from("shopping_items")
      .update({ status: "Purchased", completed_at: now })
      .eq("id", purchaseItem.id)

    if (shopError) {
      setItems((prev) =>
        prev.map((i) => (i.id === previousItem.id ? previousItem : i)),
      )
      logSupabaseError("shopping purchase", shopError)
      showError(getSupabaseErrorMessage(shopError))
      return
    }

    if (updatePantry && newQty.trim() && purchaseItem.pantry_item_id) {
      const qty = parseFloat(newQty)
      if (!isNaN(qty)) {
        const { data: pantryRow } = await supabase
          .from("pantry_items")
          .select("minimum_quantity")
          .eq("id", purchaseItem.pantry_item_id)
          .single()

        const minQty = pantryRow?.minimum_quantity ?? 0
        const status = computePantryStatus(qty, minQty)
        const { error: pantryError } = await supabase
          .from("pantry_items")
          .update({ quantity: qty, status, updated_at: now })
          .eq("id", purchaseItem.pantry_item_id)

        if (pantryError) {
          logSupabaseError("pantry update from purchase", pantryError)
          showError(getSupabaseErrorMessage(pantryError))
        }
      }
    }

    setPurchaseItem(null)
    setNewQty("")
    showSuccess("Item marked as purchased")
  }

  async function handleAddItem(form: {
    name: string
    quantity_needed: string
    category: string
    priority: Priority
    notes: string
    home_id: string
  }) {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in to add shopping items.")
      return
    }
    const { data: inserted, error } = await supabase
      .from("shopping_items")
      .insert({ ...form, status: "Open", added_by: userId })
      .select("*")
      .single()
    if (error) {
      logSupabaseError("shopping insert", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    let row = inserted as ShoppingItem | null
    if (!row) {
      const { data: fallback } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("home_id", form.home_id)
        .eq("name", form.name.trim())
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      row = (fallback as ShoppingItem) ?? null
    }
    if (row) {
      const attached = attachHomes([row], homes)[0]
      setItems((prev) => mergeById(prev, attached))
    }
    await loadItems({ silent: true })
    setShowAdd(false)
    showSuccess("Added to shopping list")
  }

  async function handleRemove(item: ShoppingItem) {
    if (!confirm(`Remove "${item.name}" from the shopping list?`)) return
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const { error } = await supabase
      .from("shopping_items")
      .update({ archived_at: new Date().toISOString(), status: "Archived" })
      .eq("id", item.id)
    if (error) {
      logSupabaseError("shopping archive", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    showSuccess("Item removed")
  }

  async function handleReopen(item: ShoppingItem) {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const { error } = await supabase
      .from("shopping_items")
      .update({ status: "Open", completed_at: null })
      .eq("id", item.id)
    if (error) {
      logSupabaseError("shopping reopen", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    const row = await fetchShoppingItemById(supabase, item.id, homes)
    if (row) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? row : i)),
      )
    }
    showSuccess("Item moved back to open")
  }

  // Group open items by home
  const grouped = open.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
    const key = (item.home as Home | undefined)?.name ?? "Other"
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <AppShell>
      <PageHeader
        title="Shopping List"
        subtitle={
          loading
            ? "Loading…"
            : `${open.length} open · ${purchased.length} purchased`
        }
        action={
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={!loading && homes.length === 0}
            className={ui.btnHeader}
          >
            <Plus size={15} />
            Add
          </button>
        }
      />

      {!loading && homes.length === 0 && <NoHomesBanner />}

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      {loading ? (
        <SkeletonList count={3} className="h-16" />
      ) : homes.length === 0 ? null : open.length === 0 && purchased.length === 0 ? (
        <EmptyState
          title="Shopping list is empty"
          message="Add items you need to buy for your residences."
        />
      ) : open.length === 0 ? (
        <EmptyState message="All caught up — nothing left to buy." />
      ) : (
        Object.entries(grouped).map(([homeName, groupItems]) => (
          <div key={homeName} className="mb-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              {homeName}
            </h2>
            <div className={`${ui.cardInset} px-4`}>
              {groupItems.map((item) => (
                <ShoppingItemCard
                  key={item.id}
                  item={item}
                  onPurchase={handlePurchase}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {purchased.length > 0 && (
        <div className="mb-5">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Purchased
          </h2>
          <div className={`${ui.cardInset} px-4 opacity-70`}>
            {purchased.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ShoppingItemCard item={item} />
                </div>
                <button
                  type="button"
                  onClick={() => handleReopen(item)}
                  className={`${ui.btnSecondary} shrink-0 px-4 text-xs`}
                >
                  Reopen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {purchaseItem && (
        <SheetModal
          open
          onClose={() => setPurchaseItem(null)}
          title="Mark Purchased"
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => confirmPurchase(false)}
                className={`${ui.btnSecondary} min-h-[48px] flex-1 py-3.5`}
              >
                Just Mark Purchased
              </button>
              <button
                type="button"
                onClick={() => confirmPurchase(true)}
                className="chef-btn-primary flex min-h-[48px] flex-1 items-center justify-center gap-2 py-3.5"
              >
                <Check size={15} />
                Update Pantry
              </button>
            </div>
          }
        >
          <p className="mb-5 text-sm text-slate-500">
            Marking <strong>{purchaseItem.name}</strong> as purchased. Update pantry
            quantity?
          </p>
          <FormField
            label="New Pantry Quantity (optional)"
            value={newQty}
            onChange={setNewQty}
            placeholder="e.g. 2"
          />
        </SheetModal>
      )}

      {showAdd && (
        <AddShoppingModal
          homes={homes}
          onClose={() => setShowAdd(false)}
          onSave={handleAddItem}
        />
      )}
    </AppShell>
  )
}

function AddShoppingModal({
  homes,
  onSave,
  onClose,
}: {
  homes: Home[]
  onSave: (form: {
    name: string
    quantity_needed: string
    category: string
    priority: Priority
    notes: string
    home_id: string
  }) => void | Promise<void>
  onClose: () => void
}) {
  const formId = "add-shopping-form"
  const [name, setName] = useState("")
  const [qtyNeeded, setQtyNeeded] = useState("")
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState<Priority>("Normal")
  const [notes, setNotes] = useState("")
  const [homeId, setHomeId] = useState("")
  const [saving, setSaving] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  useEffect(() => {
    if (homes.length > 0 && !homeId) setHomeId(homes[0].id)
  }, [homes, homeId])

  const validation = useMemo(() => {
    const missing: string[] = []
    if (!name.trim()) missing.push("item name")
    if (!homeId) missing.push("residence")
    if (homes.length === 0) missing.push("add a residence first")
    return { canSubmit: missing.length === 0 && !saving, missing }
  }, [name, homeId, homes.length, saving])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validation.canSubmit) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        quantity_needed: qtyNeeded.trim(),
        category: category.trim(),
        priority,
        notes: notes.trim(),
        home_id: homeId,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetModal
      open
      onClose={onClose}
      title="Add Shopping Item"
      footer={
        <ModalSubmitFooter
          formId={formId}
          label="Add to List"
          saving={saving}
          disabled={!validation.canSubmit}
          missing={validation.missing}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {homes.length === 0 ? (
          <NoHomesBanner compact />
        ) : homes.length > 1 ? (
          <div>
            <label className="chef-label">Residence</label>
            <select
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
          </div>
        ) : (
          <p className="rounded-xl border border-stone-200/80 bg-stone-50/50 px-4 py-3 text-sm font-medium text-charcoal">
            {homes[0].name}
          </p>
        )}
        <FormField label="Item Name" value={name} onChange={setName} placeholder="e.g. Milk" required />
        <FormField label="Quantity Needed" value={qtyNeeded} onChange={setQtyNeeded} placeholder="e.g. 2L" />
        <FormField label="Category (optional)" value={category} onChange={setCategory} placeholder="e.g. Dairy" />
        <div>
          <label className="chef-label">Priority</label>
          <div className="flex gap-2">
            {(["Normal", "Important", "Urgent"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`min-h-[44px] flex-1 rounded-xl border text-xs font-semibold transition-colors ${
                  priority === p
                    ? "border-navy bg-navy text-ivory"
                    : "border-stone-200/80 bg-surface text-stone-600"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowNotes((v) => !v)}
          className={`${ui.btnText} -ml-2 w-full justify-center text-stone-500`}
        >
          {showNotes ? "Hide notes" : "Add notes (optional)"}
        </button>
        {showNotes && (
          <FormField label="Notes" value={notes} onChange={setNotes} placeholder="Any details…" />
        )}
      </form>
    </SheetModal>
  )
}

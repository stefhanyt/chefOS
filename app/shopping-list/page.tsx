"use client"

import { useState, useEffect } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import ShoppingItemCard from "@/components/ShoppingItemCard"
import { mockShoppingItems, mockHomes } from "@/lib/mock-data"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Home, ShoppingItem, Priority } from "@/lib/types"
import { Plus, X, Check } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [homes, setHomes] = useState<Home[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [purchaseItem, setPurchaseItem] = useState<ShoppingItem | null>(null)
  const [newQty, setNewQty] = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      if (!supabase) {
        setItems(mockShoppingItems)
        setHomes(mockHomes)
        setLoading(false)
        return
      }
      try {
        const [itemsRes, homesRes] = await Promise.all([
          supabase
            .from("shopping_items")
            .select(
              "*, home:homes(id, name, location), added_by_profile:profiles!added_by(id, display_name, email)"
            )
            .is("archived_at", null)
            .in("status", ["Open", "Purchased"])
            .order("created_at", { ascending: false }),
          supabase
            .from("homes")
            .select("id, name")
            .is("archived_at", null)
            .order("name"),
        ])
        if (itemsRes.error) throw itemsRes.error
        setItems((itemsRes.data as ShoppingItem[]) ?? [])
        setHomes((homesRes.data as Home[]) ?? [])
      } catch {
        setError("Failed to load shopping list. Check your connection and try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    const ITEM_SELECT =
      "*, home:homes(id, name, location), added_by_profile:profiles!added_by(id, display_name, email)"

    const channel = supabase
      .channel("shopping-items-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shopping_items" },
        async (payload) => {
          const id = (payload.new as any).id as string
          const { data } = await supabase
            .from("shopping_items")
            .select(ITEM_SELECT)
            .eq("id", id)
            .is("archived_at", null)
            .single()
          if (!data) return
          setItems((prev) =>
            prev.find((i) => i.id === id) ? prev : [data as ShoppingItem, ...prev]
          )
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shopping_items" },
        async (payload) => {
          const updated = payload.new as any
          if (updated.archived_at || !["Open", "Purchased"].includes(updated.status)) {
            setItems((prev) => prev.filter((i) => i.id !== updated.id))
            return
          }
          const { data } = await supabase
            .from("shopping_items")
            .select(ITEM_SELECT)
            .eq("id", updated.id)
            .single()
          if (data) {
            setItems((prev) =>
              prev.map((i) => (i.id === updated.id ? (data as ShoppingItem) : i))
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
  }, [])

  const open = items.filter((i) => i.status === "Open")
  const purchased = items.filter((i) => i.status === "Purchased")

  function handlePurchase(id: string) {
    const item = items.find((i) => i.id === id)
    if (item) setPurchaseItem(item)
  }

  async function confirmPurchase(updatePantry: boolean) {
    if (!purchaseItem) return

    const now = new Date().toISOString()
    setItems((prev) =>
      prev.map((i) =>
        i.id === purchaseItem.id
          ? { ...i, status: "Purchased", completed_at: now }
          : i
      )
    )

    const supabase = createClient()
    if (supabase) {
      await supabase
        .from("shopping_items")
        .update({ status: "Purchased", completed_at: now })
        .eq("id", purchaseItem.id)

      if (
        updatePantry &&
        newQty.trim() &&
        purchaseItem.pantry_item_id
      ) {
        const qty = parseFloat(newQty)
        if (!isNaN(qty)) {
          await supabase
            .from("pantry_items")
            .update({ quantity: qty, updated_at: now })
            .eq("id", purchaseItem.pantry_item_id)
        }
      }
    }

    setPurchaseItem(null)
    setNewQty("")
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
      const newItem: ShoppingItem = {
        id: crypto.randomUUID(),
        added_by: "local",
        created_at: new Date().toISOString(),
        status: "Open",
        home: homes.find((h) => h.id === form.home_id),
        ...form,
      }
      setItems((prev) => [newItem, ...prev])
      setShowAdd(false)
      return
    }
    const { data, error } = await supabase
      .from("shopping_items")
      .insert({ ...form, status: "Open" })
      .select(
        "*, home:homes(id, name, location), added_by_profile:profiles!added_by(id, display_name, email)"
      )
      .single()
    if (!error && data) setItems((prev) => [data as ShoppingItem, ...prev])
    setShowAdd(false)
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
            : `${open.length} open · ${purchased.length} purchased${isSupabaseConfigured ? " · live" : ""}`
        }
        action={
          <button
            onClick={() => setShowAdd(true)}
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

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[22px] bg-slate-200" />
          ))}
        </div>
      ) : open.length === 0 ? (
        <div className="mb-4 rounded-[22px] border border-[#E6EEF8] bg-white p-8 text-center text-sm text-slate-400">
          All done! Nothing left to buy.
        </div>
      ) : (
        Object.entries(grouped).map(([homeName, groupItems]) => (
          <div key={homeName} className="mb-5">
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
              {homeName}
            </h2>
            <div className="rounded-[22px] border border-[#E6EEF8] bg-white px-4 shadow-md shadow-slate-900/4">
              {groupItems.map((item) => (
                <ShoppingItemCard
                  key={item.id}
                  item={item}
                  onPurchase={handlePurchase}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {purchased.length > 0 && (
        <div className="mb-5">
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
            Purchased
          </h2>
          <div className="rounded-[22px] border border-[#E6EEF8] bg-white px-4 opacity-60 shadow-md shadow-slate-900/4">
            {purchased.map((item) => (
              <ShoppingItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* PURCHASE CONFIRMATION MODAL */}
      {purchaseItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-white px-6 pb-10 pt-6 shadow-2xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">
                Mark Purchased
              </h2>
              <button
                onClick={() => setPurchaseItem(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-5 text-sm text-slate-500">
              Marking <strong>{purchaseItem.name}</strong> as purchased. Do you
              want to update the pantry quantity?
            </p>

            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              New Pantry Quantity (optional)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="e.g. 2"
              className="mb-5 w-full rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />

            <div className="flex gap-3">
              <button
                onClick={() => confirmPurchase(false)}
                className="flex-1 rounded-2xl border border-[#E6EEF8] py-3.5 text-sm font-bold text-slate-600"
              >
                Just Mark Purchased
              </button>
              <button
                onClick={() => confirmPurchase(true)}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30"
              >
                <Check size={15} />
                Update Pantry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ITEM MODAL */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-y-auto rounded-t-[32px] bg-white px-6 pb-10 pt-6 shadow-2xl max-h-[90vh]">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">
                Add Shopping Item
              </h2>
              <button
                onClick={() => setShowAdd(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <AddShoppingForm
              homes={homes}
              onSave={handleAddItem}
              onClose={() => setShowAdd(false)}
            />
          </div>
        </div>
      )}
    </AppShell>
  )
}

function AddShoppingForm({
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
  }) => void
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [qtyNeeded, setQtyNeeded] = useState("")
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState<Priority>("Normal")
  const [notes, setNotes] = useState("")
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
      <FormField label="Item Name" value={name} onChange={setName} placeholder="e.g. Milk" />
      <FormField label="Quantity Needed" value={qtyNeeded} onChange={setQtyNeeded} placeholder="e.g. 2L" />
      <FormField label="Category (optional)" value={category} onChange={setCategory} placeholder="e.g. Dairy" />
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
          Priority
        </label>
        <div className="flex gap-2">
          {(["Normal", "Important", "Urgent"] as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition-colors ${
                priority === p
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-[#E6EEF8] text-slate-600"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <FormField label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Any details…" />
      <button
        disabled={!name.trim() || !homeId}
        onClick={() =>
          onSave({
            name: name.trim(),
            quantity_needed: qtyNeeded.trim(),
            category: category.trim(),
            priority,
            notes: notes.trim(),
            home_id: homeId,
          })
        }
        className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30 disabled:opacity-50"
      >
        Add to List
      </button>
    </div>
  )
}

function FormField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  )
}

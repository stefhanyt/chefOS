"use client"

import { useState, useEffect } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import PantryItemCard from "@/components/PantryItemCard"
import SearchAndFilterBar from "@/components/SearchAndFilterBar"
import { mockPantryItems, mockHomes } from "@/lib/mock-data"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Home, PantryItem, PantryStatus } from "@/lib/types"
import { Plus, X } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"

const STATUS_FILTERS: (PantryStatus | "All")[] = [
  "All",
  "Critical",
  "Out of Stock",
  "Low",
  "OK",
]

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [homes, setHomes] = useState<Home[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<PantryStatus | "All">("All")
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      if (!supabase) {
        setItems(mockPantryItems)
        setHomes(mockHomes)
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
      } catch {
        setError("Failed to load pantry. Check your connection and try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    const channel = supabase
      .channel("pantry-items-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pantry_items" },
        async (payload) => {
          const id = (payload.new as any).id as string
          const { data } = await supabase
            .from("pantry_items")
            .select("*, home:homes(id, name, location)")
            .eq("id", id)
            .is("archived_at", null)
            .single()
          if (!data) return
          setItems((prev) =>
            prev.find((i) => i.id === id) ? prev : [data as PantryItem, ...prev]
          )
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pantry_items" },
        async (payload) => {
          const updated = payload.new as any
          if (updated.archived_at) {
            setItems((prev) => prev.filter((i) => i.id !== updated.id))
            return
          }
          const { data } = await supabase
            .from("pantry_items")
            .select("*, home:homes(id, name, location)")
            .eq("id", updated.id)
            .single()
          if (data) {
            setItems((prev) =>
              prev.map((i) => (i.id === updated.id ? (data as PantryItem) : i))
            )
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "pantry_items" },
        (payload) => {
          setItems((prev) => prev.filter((i) => i.id !== (payload.old as any).id))
        }
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
    const matchStatus =
      statusFilter === "All" || item.status === statusFilter
    return matchSearch && matchStatus
  })

  async function handleQuantityChange(id: string, delta: number) {
    const item = items.find((i) => i.id === id)
    if (!item) return

    const newQty = Math.max(0, item.quantity + delta)
    let status: PantryStatus = "OK"
    if (newQty === 0) status = "Out of Stock"
    else if (newQty < item.minimum_quantity) status = "Critical"
    else if (newQty <= item.minimum_quantity * 1.25) status = "Low"

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: newQty, status } : i))
    )

    const supabase = createClient()
    if (!supabase) return
    await supabase
      .from("pantry_items")
      .update({ quantity: newQty, status, updated_at: new Date().toISOString() })
      .eq("id", id)
  }

  async function handleAddItem(form: {
    name: string
    quantity: number
    unit: string
    category: string
    storage_location: string
    minimum_quantity: number
    home_id: string
  }) {
    const supabase = createClient()
    if (!supabase) {
      const newItem: PantryItem = {
        id: crypto.randomUUID(),
        created_by: "local",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "OK",
        ...form,
      }
      setItems((prev) => [newItem, ...prev])
      setShowModal(false)
      return
    }
    const { data, error } = await supabase
      .from("pantry_items")
      .insert({ ...form, status: "OK" })
      .select("*, home:homes(id, name, location)")
      .single()
    if (!error && data) setItems((prev) => [data as PantryItem, ...prev])
    setShowModal(false)
  }

  const alertCount = items.filter(
    (i) => i.status === "Critical" || i.status === "Out of Stock"
  ).length

  return (
    <AppShell>
      <PageHeader
        title="Pantry"
        subtitle={
          loading
            ? "Loading…"
            : `${items.length} items${alertCount > 0 ? ` · ${alertCount} alerts` : ""}${isSupabaseConfigured ? " · live" : ""}`
        }
        action={
          <button
            onClick={() => setShowModal(true)}
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

      <SearchAndFilterBar
        value={search}
        onChange={setSearch}
        placeholder="Search pantry…"
      />

      {/* STATUS FILTER CHIPS */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
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
          />
        ))
      )}

      {/* ADD PANTRY ITEM MODAL */}
      {showModal && (
        <Modal title="Add Pantry Item" onClose={() => setShowModal(false)}>
          <AddPantryForm
            homes={homes}
            onSave={handleAddItem}
            onClose={() => setShowModal(false)}
          />
        </Modal>
      )}
    </AppShell>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-y-auto rounded-t-[32px] bg-white px-6 pb-10 pt-6 shadow-2xl max-h-[90vh]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AddPantryForm({
  homes,
  onSave,
  onClose,
}: {
  homes: Home[]
  onSave: (form: {
    name: string
    quantity: number
    unit: string
    category: string
    storage_location: string
    minimum_quantity: number
    home_id: string
  }) => void
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("0")
  const [unit, setUnit] = useState("")
  const [category, setCategory] = useState("")
  const [storageLocation, setStorageLocation] = useState("")
  const [minQty, setMinQty] = useState("0")
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
      <Field label="Item Name" value={name} onChange={setName} placeholder="e.g. Organic Eggs" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity" value={quantity} onChange={setQuantity} placeholder="0" type="number" />
        <Field label="Unit" value={unit} onChange={setUnit} placeholder="e.g. dozen" />
      </div>
      <Field label="Category" value={category} onChange={setCategory} placeholder="e.g. Dairy & Eggs" />
      <Field label="Storage Location" value={storageLocation} onChange={setStorageLocation} placeholder="e.g. Fridge" />
      <Field label="Min Quantity" value={minQty} onChange={setMinQty} placeholder="0" type="number" />
      <button
        disabled={!name.trim() || !homeId}
        onClick={() =>
          onSave({
            name: name.trim(),
            quantity: Number(quantity) || 0,
            unit: unit.trim(),
            category: category.trim(),
            storage_location: storageLocation.trim(),
            minimum_quantity: Number(minQty) || 0,
            home_id: homeId,
          })
        }
        className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30 disabled:opacity-50"
      >
        Save Item
      </button>
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
        inputMode={type === "number" ? "numeric" : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  )
}

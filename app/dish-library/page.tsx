"use client"

import { useState, useEffect } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import SearchAndFilterBar from "@/components/SearchAndFilterBar"
import { mockDishLibrary } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import type { DishLibraryItem } from "@/lib/types"
import { Plus, X, Clock, BookOpen } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"

export default function DishLibraryPage() {
  const [dishes, setDishes] = useState<DishLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      if (!supabase) {
        setDishes(mockDishLibrary)
        setLoading(false)
        return
      }
      try {
        const { data, error: dbError } = await supabase
          .from("dish_library")
          .select("*")
          .is("archived_at", null)
          .order("name")
        if (dbError) throw dbError
        setDishes((data as DishLibraryItem[]) ?? [])
      } catch {
        setError("Failed to load dish library. Check your connection and try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount])

  const filtered = dishes.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleAddDish(form: {
    name: string
    category: string
    ingredients: string
    prep_time: string
    storage_instructions: string
    reheating_instructions: string
    tags: string[]
  }) {
    const supabase = createClient()
    if (!supabase) {
      const newDish: DishLibraryItem = {
        id: crypto.randomUUID(),
        created_by: "local",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: "",
        ...form,
      }
      setDishes((prev) => [newDish, ...prev])
      setShowModal(false)
      return
    }
    const { data, error } = await supabase
      .from("dish_library")
      .insert(form)
      .select("*")
      .single()
    if (!error && data) setDishes((prev) => [data as DishLibraryItem, ...prev])
    setShowModal(false)
  }

  return (
    <AppShell>
      <PageHeader
        title="Dish Library"
        subtitle={
          loading
            ? "Loading…"
            : `${dishes.length} recipe${dishes.length !== 1 ? "s" : ""}`
        }
        action={
          <button
            onClick={() => setShowModal(true)}
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30"
          >
            <Plus size={15} />
            New Dish
          </button>
        }
      />

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      <SearchAndFilterBar
        value={search}
        onChange={setSearch}
        placeholder="Search dishes…"
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-[22px] bg-slate-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[22px] border border-[#E6EEF8] bg-white p-8 text-center text-sm text-slate-400">
          {search ? "No dishes found." : "Library is empty. Add your first dish!"}
        </div>
      ) : (
        filtered.map((dish) => (
          <div
            key={dish.id}
            className="mb-4 rounded-[22px] border border-[#E6EEF8] bg-white p-5 shadow-md shadow-slate-900/4"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="font-extrabold text-slate-900">{dish.name}</h3>
                <p className="mt-0.5 text-xs text-slate-400">{dish.category}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                <Clock size={11} />
                {dish.prep_time}
              </div>
            </div>

            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
              {dish.ingredients}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {dish.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {dish.notes && (
              <p className="mt-3 text-xs italic text-slate-400">{dish.notes}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-2xl border border-[#E6EEF8] py-2.5 text-xs font-bold text-slate-600">
                Edit
              </button>
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-blue-600 py-2.5 text-xs font-extrabold text-white">
                <BookOpen size={13} />
                Use to Log Meal
              </button>
            </div>
          </div>
        ))
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-white px-6 pb-10 pt-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">New Dish</h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <NewDishForm onSave={handleAddDish} onClose={() => setShowModal(false)} />
          </div>
        </div>
      )}
    </AppShell>
  )
}

function NewDishForm({
  onSave,
  onClose,
}: {
  onSave: (form: {
    name: string
    category: string
    ingredients: string
    prep_time: string
    storage_instructions: string
    reheating_instructions: string
    tags: string[]
  }) => void
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [ingredients, setIngredients] = useState("")
  const [prepTime, setPrepTime] = useState("")
  const [storage, setStorage] = useState("")
  const [reheating, setReheating] = useState("")
  const [tagsRaw, setTagsRaw] = useState("")

  return (
    <div className="space-y-4">
      <Field label="Dish Name" value={name} onChange={setName} placeholder="e.g. Truffle Risotto" />
      <Field label="Category" value={category} onChange={setCategory} placeholder="e.g. Pasta & Grains" />
      <Field label="Ingredients" value={ingredients} onChange={setIngredients} placeholder="Comma-separated list" />
      <Field label="Prep Time" value={prepTime} onChange={setPrepTime} placeholder="e.g. 45 min" />
      <Field label="Storage Instructions" value={storage} onChange={setStorage} placeholder="e.g. Fridge up to 3 days" />
      <Field label="Reheating Instructions" value={reheating} onChange={setReheating} placeholder="e.g. Stove, medium heat" />
      <Field
        label="Tags (comma-separated)"
        value={tagsRaw}
        onChange={setTagsRaw}
        placeholder="e.g. gluten-free, quick"
      />
      <button
        disabled={!name.trim()}
        onClick={() =>
          onSave({
            name: name.trim(),
            category: category.trim(),
            ingredients: ingredients.trim(),
            prep_time: prepTime.trim(),
            storage_instructions: storage.trim(),
            reheating_instructions: reheating.trim(),
            tags: tagsRaw
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          })
        }
        className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30 disabled:opacity-50"
      >
        Save Dish
      </button>
    </div>
  )
}

function Field({
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

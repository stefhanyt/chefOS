"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import SearchAndFilterBar from "@/components/SearchAndFilterBar"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import {
  fetchDishLibrary,
  logClientFilter,
  mergeById,
} from "@/lib/supabase/list-fetch"
import { useToast } from "@/components/ToastProvider"
import type { DishLibraryItem } from "@/lib/types"
import { Plus, Clock, BookOpen, Trash2 } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"
import EmptyState from "@/components/EmptyState"
import { SkeletonList } from "@/components/Skeleton"
import { ui } from "@/lib/ui"
import SheetModal from "@/components/SheetModal"
import FormField from "@/components/FormField"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import { CONFIG_ERROR } from "@/lib/constants"

export default function DishLibraryPage() {
  const { showSuccess, showError } = useToast()
  const [dishes, setDishes] = useState<DishLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingDish, setEditingDish] = useState<DishLibraryItem | null>(null)

  const loadDishes = useCallback(
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
        const { data, error: dbError } = await fetchDishLibrary(supabase)
        if (dbError) throw dbError
        setDishes(data)
      } catch (err) {
        logSupabaseError("dish library load", err)
        setError("Failed to load dish library. Check your connection and try again.")
        showError(getSupabaseErrorMessage(err))
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [showError],
  )

  useEffect(() => {
    loadDishes()
  }, [retryCount, loadDishes])

  const filtered = useMemo(() => {
    const next = dishes.filter(
      (d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (Array.isArray(d.tags) ? d.tags : []).some((t) =>
          String(t).toLowerCase().includes(search.toLowerCase()),
        ),
    )
    logClientFilter("dish_library", dishes.length, next.length, { search })
    return next
  }, [dishes, search])

  async function handleAddDish(form: DishFormInput) {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in to add dishes.")
      return
    }
    const { data, error } = await supabase
      .from("dish_library")
      .insert({ ...form, created_by: userId })
      .select("*")
      .single()
    if (error) {
      logSupabaseError("dish insert", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    if (data) setDishes((prev) => mergeById(prev, data as DishLibraryItem))
    await loadDishes({ silent: true })
    setShowModal(false)
    showSuccess("Dish added to library")
  }

  async function handleUpdateDish(id: string, form: DishFormInput) {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const { data, error } = await supabase
      .from("dish_library")
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single()
    if (error) {
      logSupabaseError("dish update", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    if (data) {
      setDishes((prev) =>
        prev.map((d) => (d.id === id ? (data as DishLibraryItem) : d)),
      )
    }
    await loadDishes({ silent: true })
    setEditingDish(null)
    showSuccess("Dish updated")
  }

  async function handleArchiveDish(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the dish library?`)) return
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const { error } = await supabase
      .from("dish_library")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
    if (error) {
      logSupabaseError("dish archive", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    setDishes((prev) => prev.filter((d) => d.id !== id))
    showSuccess("Dish removed from library")
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
            className={ui.btnHeader}
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
        <SkeletonList count={2} className="h-36" />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            search ? "No dishes match your search." : "Your recipe library is empty. Add your first dish."
          }
        />
      ) : (
        filtered.map((dish) => (
          <div key={dish.id} className={`${ui.cardElevated} mb-4 p-5`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="font-display text-lg font-semibold text-charcoal">{dish.name}</h3>
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
              {(Array.isArray(dish.tags) ? dish.tags : []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy-light"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingDish(dish)}
                className={`${ui.btnSecondary} flex-1 text-xs`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleArchiveDish(dish.id, dish.name)}
                className={`${ui.btnIcon} border border-red-100 text-red-500`}
                aria-label={`Remove ${dish.name}`}
              >
                <Trash2 size={18} />
              </button>
              <a
                href="/meals"
                className={`${ui.btnPrimary} flex-1 gap-1.5 text-xs`}
              >
                <BookOpen size={13} />
                Log Meal
              </a>
            </div>
          </div>
        ))
      )}

      {showModal && (
        <DishFormModal title="New Dish" onClose={() => setShowModal(false)} onSave={handleAddDish} />
      )}

      {editingDish && (
        <DishFormModal
          title="Edit Dish"
          onClose={() => setEditingDish(null)}
          initial={editingDish}
          onSave={(form) => handleUpdateDish(editingDish.id, form)}
        />
      )}
    </AppShell>
  )
}

type DishFormInput = {
  name: string
  category: string
  ingredients: string
  prep_time: string
  storage_instructions: string
  reheating_instructions: string
  tags: string[]
}

function DishFormModal({
  title,
  onClose,
  initial,
  onSave,
}: {
  title: string
  onClose: () => void
  initial?: DishLibraryItem
  onSave: (form: DishFormInput) => void | Promise<void>
}) {
  const formId = "dish-form"
  const [name, setName] = useState(initial?.name ?? "")
  const [category, setCategory] = useState(initial?.category ?? "")
  const [ingredients, setIngredients] = useState(initial?.ingredients ?? "")
  const [prepTime, setPrepTime] = useState(initial?.prep_time ?? "")
  const [storage, setStorage] = useState(initial?.storage_instructions ?? "")
  const [reheating, setReheating] = useState(initial?.reheating_instructions ?? "")
  const [tagsRaw, setTagsRaw] = useState(
    (Array.isArray(initial?.tags) ? initial.tags : []).join(", "),
  )
  const [saving, setSaving] = useState(false)
  const [showMore, setShowMore] = useState(
    Boolean(
      initial?.ingredients ||
        initial?.prep_time ||
        initial?.storage_instructions ||
        initial?.reheating_instructions ||
        (Array.isArray(initial?.tags) && initial.tags.length > 0),
    ),
  )

  const canSubmit = name.trim().length > 0 && !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      await onSave({
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetModal
      open
      onClose={onClose}
      title={title}
      footer={
        <ModalSubmitFooter
          formId={formId}
          label="Save Dish"
          saving={saving}
          disabled={!canSubmit}
          missing={!name.trim() ? ["dish name"] : []}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Dish Name" value={name} onChange={setName} placeholder="e.g. Truffle Risotto" required />
        <FormField label="Category" value={category} onChange={setCategory} placeholder="e.g. Pasta & Grains" />
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className={`${ui.btnText} -ml-2 w-full justify-center text-stone-500`}
        >
          {showMore ? "Fewer details" : "Recipe details (optional)"}
        </button>
        {showMore && (
          <>
            <FormField
              label="Ingredients"
              value={ingredients}
              onChange={setIngredients}
              placeholder="Main ingredients"
            />
            <FormField label="Prep Time" value={prepTime} onChange={setPrepTime} placeholder="e.g. 45 min" />
            <FormField
              label="Storage Instructions"
              value={storage}
              onChange={setStorage}
              placeholder="e.g. Fridge up to 3 days"
            />
            <FormField
              label="Reheating Instructions"
              value={reheating}
              onChange={setReheating}
              placeholder="e.g. Stove, medium heat"
            />
            <FormField
              label="Tags (comma-separated)"
              value={tagsRaw}
              onChange={setTagsRaw}
              placeholder="e.g. gluten-free, quick"
            />
          </>
        )}
      </form>
    </SheetModal>
  )
}

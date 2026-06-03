"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import SearchAndFilterBar from "@/components/SearchAndFilterBar"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { logClientFilter } from "@/lib/supabase/list-fetch"
import {
  fetchAllDishesWithIngredients,
  loadHomesForRepertoire,
  saveDishRepertoire,
} from "@/lib/dish-repertoire"
import type { DishRepertoireInput } from "@/lib/dish-repertoire"
import { useToast } from "@/components/ToastProvider"
import type { DishLibraryItem, Home } from "@/lib/types"
import {
  Plus,
  Clock,
  Trash2,
  Calendar,
  Home as HomeIcon,
  ShoppingCart,
  ChefHat,
} from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"
import EmptyState from "@/components/EmptyState"
import NoHomesBanner from "@/components/NoHomesBanner"
import { SkeletonList } from "@/components/Skeleton"
import { ui } from "@/lib/ui"
import { CONFIG_ERROR } from "@/lib/constants"
import DishRepertoireFormModal from "@/components/DishRepertoireFormModal"
import {
  DishAddToMenuModal,
  DishAddToResidenceModal,
  DishAddToShoppingModal,
} from "@/components/DishRepertoireActions"
import {
  REPERTOIRE_DIETARY_TAGS,
  REPERTOIRE_MEAL_CATEGORIES,
} from "@/lib/repertoire-constants"

type DishAction = "menu" | "residence" | "shopping" | null

export default function DishRepertoirePage() {
  const { showSuccess, showError } = useToast()
  const [dishes, setDishes] = useState<DishLibraryItem[]>([])
  const [homes, setHomes] = useState<Home[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("All")
  const [tagFilter, setTagFilter] = useState("All")
  const [activeOnly, setActiveOnly] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [quickModal, setQuickModal] = useState(false)
  const [editingDish, setEditingDish] = useState<DishLibraryItem | null>(null)
  const [actionDish, setActionDish] = useState<DishLibraryItem | null>(null)
  const [action, setAction] = useState<DishAction>(null)

  const loadData = useCallback(
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
        const [{ data, error: dbError }, homeList] = await Promise.all([
          fetchAllDishesWithIngredients(supabase),
          loadHomesForRepertoire(supabase),
        ])
        if (dbError) throw dbError
        setDishes(data)
        setHomes(homeList)
      } catch (err) {
        logSupabaseError("dish repertoire load", err)
        setError(
          "Failed to load dish repertoire. Run supabase-dish-repertoire.sql if this is a new setup.",
        )
        showError(getSupabaseErrorMessage(err))
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [showError],
  )

  useEffect(() => {
    loadData()
  }, [retryCount, loadData])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let next = dishes

    if (activeOnly) {
      next = next.filter((d) => d.is_active !== false)
    }
    if (categoryFilter !== "All") {
      next = next.filter(
        (d) =>
          (d.meal_category ?? d.category ?? "").toLowerCase() ===
          categoryFilter.toLowerCase(),
      )
    }
    if (tagFilter !== "All") {
      next = next.filter((d) => {
        const tags = [
          ...(d.dietary_tags ?? []),
          ...(Array.isArray(d.tags) ? d.tags : []),
        ].map((t) => String(t).toLowerCase())
        return tags.includes(tagFilter.toLowerCase())
      })
    }
    if (q) {
      next = next.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.description ?? "").toLowerCase().includes(q) ||
          (d.cuisine_style ?? "").toLowerCase().includes(q) ||
          (d.meal_category ?? d.category ?? "").toLowerCase().includes(q) ||
          (d.ingredients ?? "").toLowerCase().includes(q),
      )
    }

    logClientFilter("dish_repertoire", dishes.length, next.length, {
      search,
      categoryFilter,
      tagFilter,
      activeOnly,
    })
    return next
  }, [dishes, search, categoryFilter, tagFilter, activeOnly])

  async function persistDish(input: DishRepertoireInput, dishId?: string) {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in to save dishes.")
      return
    }
    const { dish, error } = await saveDishRepertoire(
      supabase,
      userId,
      input,
      dishId,
    )
    if (error) {
      logSupabaseError("dish repertoire save", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    const { data: refreshed } = await fetchAllDishesWithIngredients(supabase)
    if (refreshed.length) setDishes(refreshed)
    await loadData({ silent: true })
    setShowModal(false)
    setQuickModal(false)
    setEditingDish(null)
    showSuccess(dishId ? "Dish updated" : "Dish saved to repertoire")
  }

  async function handleArchiveDish(id: string, name: string) {
    if (!confirm(`Remove "${name}" from your repertoire?`)) return
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
    showSuccess("Dish removed from repertoire")
  }

  function openAction(dish: DishLibraryItem, kind: DishAction) {
    if (homes.length === 0) {
      showError("Add a residence first to use menu and shopping actions.")
      return
    }
    setActionDish(dish)
    setAction(kind)
  }

  const activeCount = dishes.filter((d) => d.is_active !== false).length

  return (
    <AppShell>
      <PageHeader
        title="Dish Repertoire"
        subtitle={
          loading
            ? "Loading…"
            : `${activeCount} reusable dish${activeCount !== 1 ? "es" : ""} · menus & shopping`
        }
        action={
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setQuickModal(true)}
              className={ui.btnSecondary}
            >
              Quick
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className={ui.btnHeader}
            >
              <Plus size={15} />
              New Dish
            </button>
          </div>
        }
      />

      {homes.length === 0 && !loading && <NoHomesBanner compact />}

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      <SearchAndFilterBar
        value={search}
        onChange={setSearch}
        placeholder="Search dishes…"
      />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategoryFilter("All")}
          className={categoryFilter === "All" ? ui.chipActive : ui.chip}
        >
          All meals
        </button>
        {REPERTOIRE_MEAL_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryFilter(c)}
            className={categoryFilter === c ? ui.chipActive : ui.chip}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setTagFilter("All")}
          className={tagFilter === "All" ? ui.chipActive : ui.chip}
        >
          All tags
        </button>
        {REPERTOIRE_DIETARY_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTagFilter(t)}
            className={tagFilter === t ? ui.chipActive : ui.chip}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveOnly((v) => !v)}
          className={activeOnly ? ui.chipActive : ui.chip}
        >
          Active only
        </button>
      </div>

      {loading ? (
        <SkeletonList count={2} className="h-40" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search || categoryFilter !== "All" ? undefined : "Build your repertoire"}
          message={
            search || categoryFilter !== "All" || tagFilter !== "All"
              ? "No dishes match your filters."
              : "Save dishes once with structured ingredients, then add them to menus and shopping lists in one tap."
          }
          icon={<ChefHat size={22} strokeWidth={1.5} />}
          action={
            !search && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className={ui.btnPrimary}
              >
                <Plus size={15} />
                Add first dish
              </button>
            )
          }
        />
      ) : (
        filtered.map((dish) => {
          const tags = [
            ...(dish.dietary_tags ?? []),
            ...(Array.isArray(dish.tags) ? dish.tags : []),
          ]
          const uniqueTags = Array.from(new Set(tags.map(String)))
          const ingCount = dish.dish_ingredients?.length ?? 0
          const summary =
            dish.description?.trim() ||
            (ingCount > 0
              ? `${ingCount} ingredient${ingCount !== 1 ? "s" : ""}`
              : dish.ingredients?.slice(0, 120))

          return (
            <div key={dish.id} className={`${ui.cardElevated} mb-4 p-5`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-charcoal">
                      {dish.name}
                    </h3>
                    {dish.is_active === false && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-stone-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {dish.meal_category ?? dish.category}
                    {dish.cuisine_style ? ` · ${dish.cuisine_style}` : ""}
                  </p>
                </div>
                {dish.prep_time && (
                  <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                    <Clock size={11} />
                    {dish.prep_time}
                  </div>
                )}
              </div>

              {summary && (
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
                  {summary}
                </p>
              )}

              {uniqueTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {uniqueTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy-light"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => openAction(dish, "menu")}
                  className={`${ui.btnSecondary} w-full gap-1.5 text-xs sm:flex-1`}
                >
                  <Calendar size={14} />
                  Add to Menu
                </button>
                <button
                  type="button"
                  onClick={() => openAction(dish, "residence")}
                  className={`${ui.btnSecondary} w-full gap-1.5 text-xs sm:flex-1`}
                >
                  <HomeIcon size={14} />
                  Add to Residence
                </button>
                <button
                  type="button"
                  onClick={() => openAction(dish, "shopping")}
                  className={`${ui.btnPrimary} w-full gap-1.5 text-xs sm:flex-1`}
                >
                  <ShoppingCart size={14} />
                  Shopping List
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDish(dish)}
                  className={`${ui.btnText} flex-1 justify-center rounded-xl border border-stone-200/80 text-xs`}
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
              </div>
            </div>
          )
        })
      )}

      {showModal && (
        <DishRepertoireFormModal
          title="New Dish"
          onClose={() => setShowModal(false)}
          onSave={(form) => persistDish(form)}
        />
      )}

      {quickModal && (
        <DishRepertoireFormModal
          title="Quick Add Dish"
          quick
          onClose={() => setQuickModal(false)}
          onSave={(form) => persistDish(form)}
        />
      )}

      {editingDish && (
        <DishRepertoireFormModal
          title="Edit Dish"
          initial={editingDish}
          onClose={() => setEditingDish(null)}
          onSave={(form) => persistDish(form, editingDish.id)}
        />
      )}

      {actionDish && action === "menu" && (
        <DishAddToMenuModal
          dish={actionDish}
          homes={homes}
          onClose={() => {
            setAction(null)
            setActionDish(null)
          }}
          onSuccess={showSuccess}
          onError={showError}
        />
      )}

      {actionDish && action === "residence" && (
        <DishAddToResidenceModal
          dish={actionDish}
          homes={homes}
          onClose={() => {
            setAction(null)
            setActionDish(null)
          }}
          onSuccess={showSuccess}
          onError={showError}
        />
      )}

      {actionDish && action === "shopping" && (
        <DishAddToShoppingModal
          dish={actionDish}
          homes={homes}
          onClose={() => {
            setAction(null)
            setActionDish(null)
          }}
          onSuccess={showSuccess}
          onError={showError}
        />
      )}
    </AppShell>
  )
}

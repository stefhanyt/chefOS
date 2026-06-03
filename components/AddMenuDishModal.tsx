"use client"

import { useMemo, useState } from "react"
import { BookOpen, PenLine, Plus, Search } from "lucide-react"
import SheetModal from "@/components/SheetModal"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import type { DishLibraryItem } from "@/lib/types"
import {
  filterDishesForMenu,
  isDishAlreadyOnMenu,
} from "@/lib/menu-dish-picker"
import { ui } from "@/lib/ui"

type Tab = "library" | "manual" | "create"

export default function AddMenuDishModal({
  open,
  onClose,
  menuCategory,
  dayLabel,
  dishes,
  alreadyAdded,
  onSelectDish,
  onAddManual,
  onCreateDish,
}: {
  open: boolean
  onClose: () => void
  menuCategory: string
  dayLabel: string
  dishes: DishLibraryItem[]
  alreadyAdded: { dish: string; dish_id?: string | null }[]
  onSelectDish: (dish: DishLibraryItem) => void | Promise<void>
  onAddManual: (name: string) => void | Promise<void>
  onCreateDish: (name: string, category: string) => Promise<DishLibraryItem | null>
}) {
  const [tab, setTab] = useState<Tab>("library")
  const [search, setSearch] = useState("")
  const [manualName, setManualName] = useState("")
  const [createName, setCreateName] = useState("")
  const [createCategory, setCreateCategory] = useState(menuCategory)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(
    () => filterDishesForMenu(dishes, search, menuCategory),
    [dishes, search, menuCategory],
  )

  const trimmedSearch = search.trim()
  const showCreateFromSearch =
    tab === "library" &&
    trimmedSearch.length > 0 &&
    !filtered.some(
      (d) => d.name.trim().toLowerCase() === trimmedSearch.toLowerCase(),
    )

  function resetAndClose() {
    setSearch("")
    setManualName("")
    setCreateName("")
    setCreateCategory(menuCategory)
    setTab("library")
    onClose()
  }

  async function handleSelect(dish: DishLibraryItem) {
    if (isDishAlreadyOnMenu(alreadyAdded, dish)) return
    setSaving(true)
    try {
      await onSelectDish(dish)
      resetAndClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = manualName.trim()
    if (!name) return
    setSaving(true)
    try {
      await onAddManual(name)
      resetAndClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = createName.trim()
    if (!name) return
    setSaving(true)
    try {
      const created = await onCreateDish(name, createCategory.trim() || menuCategory)
      if (created) {
        await onSelectDish(created)
        resetAndClose()
      }
    } finally {
      setSaving(false)
    }
  }

  function openCreateTab(prefill?: string) {
    setCreateName(prefill ?? trimmedSearch)
    setCreateCategory(menuCategory)
    setTab("create")
  }

  return (
    <SheetModal
      open={open}
      onClose={resetAndClose}
      title={`Add ${menuCategory}`}
      footer={
        tab === "manual" ? (
          <ModalSubmitFooter
            formId="menu-manual-dish"
            label="Add to menu"
            saving={saving}
            disabled={!manualName.trim() || saving}
            missing={!manualName.trim() ? ["dish name"] : []}
          />
        ) : tab === "create" ? (
          <ModalSubmitFooter
            formId="menu-create-dish"
            label="Save & add to menu"
            saving={saving}
            disabled={!createName.trim() || saving}
            missing={!createName.trim() ? ["dish name"] : []}
          />
        ) : undefined
      }
    >
      <p className="mb-4 text-sm text-stone-500">
        {dayLabel} · pick from your library or enter a one-off name
      </p>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("library")}
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition ${
            tab === "library"
              ? "bg-navy text-ivory shadow-soft"
              : "border border-stone-200/80 bg-stone-50 text-stone-600"
          }`}
        >
          <BookOpen size={14} />
          Library
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition ${
            tab === "manual"
              ? "bg-navy text-ivory shadow-soft"
              : "border border-stone-200/80 bg-stone-50 text-stone-600"
          }`}
        >
          <PenLine size={14} />
          Type manually
        </button>
      </div>

      {tab === "library" && (
        <>
          <div className="relative mb-3">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes…"
              autoComplete="off"
              className="chef-input pl-9"
            />
          </div>

          <div className="max-h-[min(50vh,320px)] space-y-2 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-stone-500">
                {dishes.length === 0
                  ? "Your dish repertoire is empty. Create a dish or type a name manually."
                  : "No dishes match your search."}
              </p>
            ) : (
              filtered.map((dish) => {
                const added = isDishAlreadyOnMenu(alreadyAdded, dish)
                const matchesCat =
                  dish.category.trim().toLowerCase() ===
                  menuCategory.trim().toLowerCase()
                return (
                  <button
                    key={dish.id}
                    type="button"
                    disabled={added || saving}
                    onClick={() => handleSelect(dish)}
                    className={`flex w-full flex-col items-start rounded-2xl border px-4 py-3.5 text-left transition ${
                      added
                        ? "cursor-default border-stone-200/60 bg-stone-50 opacity-60"
                        : "border-stone-200/80 bg-surface hover:border-navy/20 hover:bg-navy/[0.03]"
                    }`}
                  >
                    <span className="font-display text-base font-semibold text-charcoal">
                      {dish.name}
                    </span>
                    <span className="mt-0.5 text-xs text-stone-500">
                      {dish.category}
                      {!matchesCat && (
                        <span className="text-stone-400"> · other category</span>
                      )}
                      {dish.prep_time ? ` · ${dish.prep_time}` : ""}
                    </span>
                    {added && (
                      <span className="mt-1 text-xs font-semibold text-navy-light">
                        Already on this day
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {showCreateFromSearch && (
            <button
              type="button"
              onClick={() => openCreateTab(trimmedSearch)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gold/50 bg-gold/5 py-3.5 text-sm font-semibold text-navy"
            >
              <Plus size={16} />
              Create &ldquo;{trimmedSearch}&rdquo; in library
            </button>
          )}

          <button
            type="button"
            onClick={() => openCreateTab()}
            className="mt-3 w-full text-center text-xs font-semibold text-navy-light"
          >
            + New dish in library
          </button>
        </>
      )}

      {tab === "manual" && (
        <form id="menu-manual-dish" onSubmit={handleManualSubmit} className="space-y-3">
          <label className="chef-label">Dish name (not saved to library)</label>
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="e.g. Guest favorite pasta"
            required
            className="chef-input"
          />
          <p className="text-xs text-stone-500">
            Use this for one-off items. No dish link is saved — only the name on your menu.
          </p>
        </form>
      )}

      {tab === "create" && (
        <form id="menu-create-dish" onSubmit={handleCreateSubmit} className="space-y-4">
          <p className="text-sm text-stone-600">
            Save a new recipe to your library, then add it to {menuCategory.toLowerCase()}.
          </p>
          <div>
            <label className="chef-label">Dish name</label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Chicken soup"
              required
              className="chef-input"
            />
          </div>
          <div>
            <label className="chef-label">Library category</label>
            <input
              type="text"
              value={createCategory}
              onChange={(e) => setCreateCategory(e.target.value)}
              placeholder={menuCategory}
              className="chef-input"
            />
          </div>
          <button
            type="button"
            onClick={() => setTab("library")}
            className={`${ui.btnSecondary} w-full py-2.5 text-xs`}
          >
            Back to library
          </button>
        </form>
      )}
    </SheetModal>
  )
}

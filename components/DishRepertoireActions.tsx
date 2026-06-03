"use client"

import { useEffect, useState } from "react"
import SheetModal from "@/components/SheetModal"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage } from "@/lib/supabase/errors"
import {
  addDishToResidenceMealLog,
  addDishToWeeklyMenu,
  addIngredientsToShoppingList,
  scaleIngredients,
  type ShoppingIngredientLine,
} from "@/lib/dish-repertoire"
import {
  MENU_SLOT_TO_CATEGORY,
  REPERTOIRE_MEAL_CATEGORIES,
} from "@/lib/repertoire-constants"
import { MENU_DAYS, weekLabel } from "@/lib/menu-utils"
import type { DishIngredient, DishLibraryItem, Home } from "@/lib/types"
import { ui } from "@/lib/ui"
import { CONFIG_ERROR } from "@/lib/constants"

function dishIngredients(dish: DishLibraryItem): DishIngredient[] {
  return dish.dish_ingredients ?? []
}

function HomeSelect({
  homes,
  value,
  onChange,
}: {
  homes: Home[]
  value: string
  onChange: (id: string) => void
}) {
  if (homes.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Add a residence under Homes before assigning dishes.
      </p>
    )
  }
  return (
    <div>
      <label className={ui.label}>Residence</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={ui.input}
      >
        {homes.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function IngredientPicker({
  lines,
  onChange,
  mergeDuplicates,
  onMergeChange,
}: {
  lines: ShoppingIngredientLine[]
  onChange: (lines: ShoppingIngredientLine[]) => void
  mergeDuplicates: boolean
  onMergeChange: (v: boolean) => void
}) {
  if (lines.length === 0) {
    return (
      <p className="rounded-xl bg-stone-50/80 px-3 py-2 text-sm text-stone-500">
        No structured ingredients on this dish. Edit the dish to add ingredient
        lines for shopping list generation.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <label className="flex min-h-[44px] items-center gap-3 text-sm text-charcoal">
        <input
          type="checkbox"
          checked={mergeDuplicates}
          onChange={(e) => onMergeChange(e.target.checked)}
          className="h-4 w-4 rounded border-stone-300"
        />
        Merge with existing open shopping items
      </label>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-stone-200/60 p-2">
        {lines.map((line, idx) => (
          <label
            key={line.ingredient.id ?? idx}
            className="flex min-h-[44px] items-start gap-3 rounded-xl px-2 py-2 active:bg-stone-50"
          >
            <input
              type="checkbox"
              checked={line.selected}
              onChange={(e) => {
                const next = [...lines]
                next[idx] = { ...line, selected: e.target.checked }
                onChange(next)
              }}
              className="mt-1 h-4 w-4 rounded border-stone-300"
            />
            <span className="min-w-0 flex-1 text-sm text-charcoal">
              <span className="font-medium">{line.ingredient.name}</span>
              <span className="text-stone-500">
                {" "}
                — {line.scaledQuantity}
                {line.ingredient.unit ? ` ${line.ingredient.unit}` : ""}
              </span>
              {line.ingredient.category && (
                <span className="block text-xs text-stone-400">
                  {line.ingredient.category}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function DishAddToMenuModal({
  dish,
  homes,
  onClose,
  onSuccess,
  onError,
}: {
  dish: DishLibraryItem
  homes: Home[]
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}) {
  const formId = "dish-add-menu"
  const defaultHome = homes[0]?.id ?? ""
  const [homeId, setHomeId] = useState(defaultHome)
  const [weekOffset, setWeekOffset] = useState(0)
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [mealSlot, setMealSlot] = useState(
    dish.meal_category ?? dish.category ?? "Dinner",
  )
  const [portions, setPortions] = useState(dish.default_servings ?? 4)
  const [addShopping, setAddShopping] = useState(true)
  const [mergeDuplicates, setMergeDuplicates] = useState(true)
  const [lines, setLines] = useState<ShoppingIngredientLine[]>(() =>
    scaleIngredients(
      dishIngredients(dish),
      dish.default_servings ?? 4,
      dish.default_servings ?? 4,
    ),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLines(
      scaleIngredients(
        dishIngredients(dish),
        dish.default_servings ?? 4,
        portions,
      ),
    )
  }, [dish, portions])

  useEffect(() => {
    if (!homeId && homes[0]) setHomeId(homes[0].id)
  }, [homes, homeId])

  const menuCatHint = MENU_SLOT_TO_CATEGORY[mealSlot] ?? "Mains"
  const canSubmit = Boolean(homeId) && !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const supabase = createClient()
    if (!supabase) return
    const userId = await getAuthUserId(supabase)
    if (!userId) return

    setSaving(true)
    try {
      const { error } = await addDishToWeeklyMenu({
        supabase,
        userId,
        homeId,
        dish,
        dayOfWeek,
        menuCategory: mealSlot,
        portions,
        weekOffset,
      })
      if (error) throw error

      let shopMsg = ""
      if (addShopping && lines.some((l) => l.selected)) {
        const { added, merged, error: shopError } =
          await addIngredientsToShoppingList({
            supabase,
            userId,
            homeId,
            lines,
            mergeDuplicates,
          })
        if (shopError) throw shopError
        if (added + merged > 0) {
          shopMsg = ` · ${added + merged} shopping item${added + merged !== 1 ? "s" : ""}`
        }
      }

      onSuccess(
        `"${dish.name}" added to ${weekLabel(weekOffset)} ${MENU_DAYS[dayOfWeek]} (${menuCatHint})${shopMsg}`,
      )
      onClose()
    } catch (err) {
      onError(getSupabaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetModal
      open
      onClose={onClose}
      title="Add to Menu"
      footer={
        <ModalSubmitFooter
          formId={formId}
          label="Add to Weekly Menu"
          saving={saving}
          disabled={!canSubmit}
          missing={!homeId ? ["residence"] : []}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-stone-500">{dish.name}</p>
        <HomeSelect homes={homes} value={homeId} onChange={setHomeId} />
        <div>
          <label className={ui.label}>Week</label>
          <select
            value={weekOffset}
            onChange={(e) => setWeekOffset(Number(e.target.value))}
            className={ui.input}
          >
            <option value={-1}>{weekLabel(-1)}</option>
            <option value={0}>{weekLabel(0)}</option>
            <option value={1}>{weekLabel(1)}</option>
          </select>
        </div>
        <div>
          <label className={ui.label}>Day</label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className={ui.input}
          >
            {MENU_DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ui.label}>Meal slot</label>
          <select
            value={mealSlot}
            onChange={(e) => setMealSlot(e.target.value)}
            className={ui.input}
          >
            {REPERTOIRE_MEAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c} → menu {MENU_SLOT_TO_CATEGORY[c] ?? "Mains"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ui.label}>Portions</label>
          <input
            type="number"
            min={1}
            value={portions}
            onChange={(e) =>
              setPortions(Math.max(1, Number(e.target.value) || 1))
            }
            className={ui.input}
          />
        </div>
        <label className="flex min-h-[44px] items-center gap-3 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={addShopping}
            onChange={(e) => setAddShopping(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          Add ingredients to shopping list
        </label>
        {addShopping && (
          <IngredientPicker
            lines={lines}
            onChange={setLines}
            mergeDuplicates={mergeDuplicates}
            onMergeChange={setMergeDuplicates}
          />
        )}
      </form>
    </SheetModal>
  )
}

export function DishAddToResidenceModal({
  dish,
  homes,
  onClose,
  onSuccess,
  onError,
}: {
  dish: DishLibraryItem
  homes: Home[]
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}) {
  const formId = "dish-add-residence"
  const today = new Date().toISOString().split("T")[0]
  const defaultExpiry = new Date()
  defaultExpiry.setDate(defaultExpiry.getDate() + 3)
  const expiryDefault = defaultExpiry.toISOString().split("T")[0]

  const [homeId, setHomeId] = useState(homes[0]?.id ?? "")
  const [portions, setPortions] = useState(dish.default_servings ?? 4)
  const [preparedDate, setPreparedDate] = useState(today)
  const [expiryDate, setExpiryDate] = useState(expiryDefault)
  const [storageLocation, setStorageLocation] = useState("Fridge")
  const [addShopping, setAddShopping] = useState(false)
  const [mergeDuplicates, setMergeDuplicates] = useState(true)
  const [lines, setLines] = useState<ShoppingIngredientLine[]>(() =>
    scaleIngredients(
      dishIngredients(dish),
      dish.default_servings ?? 4,
      dish.default_servings ?? 4,
    ),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLines(
      scaleIngredients(
        dishIngredients(dish),
        dish.default_servings ?? 4,
        portions,
      ),
    )
  }, [dish, portions])

  const canSubmit = Boolean(homeId) && !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const supabase = createClient()
    if (!supabase) return
    const userId = await getAuthUserId(supabase)
    if (!userId) return

    setSaving(true)
    try {
      const { error } = await addDishToResidenceMealLog({
        supabase,
        userId,
        homeId,
        dish,
        portions,
        preparedDate,
        expiryDate,
        storageLocation: storageLocation.trim() || "Fridge",
      })
      if (error) throw error

      let shopMsg = ""
      if (addShopping && lines.some((l) => l.selected)) {
        const { added, merged, error: shopError } =
          await addIngredientsToShoppingList({
            supabase,
            userId,
            homeId,
            lines,
            mergeDuplicates,
          })
        if (shopError) throw shopError
        if (added + merged > 0) {
          shopMsg = ` · ${added + merged} on shopping list`
        }
      }

      const homeName = homes.find((h) => h.id === homeId)?.name ?? "residence"
      onSuccess(`"${dish.name}" logged at ${homeName}${shopMsg}`)
      onClose()
    } catch (err) {
      onError(getSupabaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetModal
      open
      onClose={onClose}
      title="Add to Residence"
      footer={
        <ModalSubmitFooter
          formId={formId}
          label="Log Prepared Meal"
          saving={saving}
          disabled={!canSubmit}
          missing={!homeId ? ["residence"] : []}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-stone-500">
          Creates a prepared meal entry for this residence.
        </p>
        <HomeSelect homes={homes} value={homeId} onChange={setHomeId} />
        <div>
          <label className={ui.label}>Portions</label>
          <input
            type="number"
            min={1}
            value={portions}
            onChange={(e) =>
              setPortions(Math.max(1, Number(e.target.value) || 1))
            }
            className={ui.input}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={ui.label}>Prepared</label>
            <input
              type="date"
              value={preparedDate}
              onChange={(e) => setPreparedDate(e.target.value)}
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label}>Expires</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className={ui.input}
            />
          </div>
        </div>
        <div>
          <label className={ui.label}>Storage</label>
          <input
            value={storageLocation}
            onChange={(e) => setStorageLocation(e.target.value)}
            className={ui.input}
            placeholder="Fridge, Freezer…"
          />
        </div>
        <label className="flex min-h-[44px] items-center gap-3 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={addShopping}
            onChange={(e) => setAddShopping(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          Add ingredients to shopping list
        </label>
        {addShopping && (
          <IngredientPicker
            lines={lines}
            onChange={setLines}
            mergeDuplicates={mergeDuplicates}
            onMergeChange={setMergeDuplicates}
          />
        )}
      </form>
    </SheetModal>
  )
}

export function DishAddToShoppingModal({
  dish,
  homes,
  onClose,
  onSuccess,
  onError,
}: {
  dish: DishLibraryItem
  homes: Home[]
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}) {
  const formId = "dish-add-shopping"
  const [homeId, setHomeId] = useState(homes[0]?.id ?? "")
  const [servings, setServings] = useState(dish.default_servings ?? 4)
  const [mergeDuplicates, setMergeDuplicates] = useState(true)
  const [lines, setLines] = useState<ShoppingIngredientLine[]>(() =>
    scaleIngredients(
      dishIngredients(dish),
      dish.default_servings ?? 4,
      dish.default_servings ?? 4,
    ),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLines(
      scaleIngredients(
        dishIngredients(dish),
        dish.default_servings ?? 4,
        servings,
      ),
    )
  }, [dish, servings])

  const selectedCount = lines.filter((l) => l.selected).length
  const canSubmit =
    Boolean(homeId) && selectedCount > 0 && !saving && lines.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const supabase = createClient()
    if (!supabase) {
      onError(CONFIG_ERROR)
      return
    }
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      onError("You must be signed in.")
      return
    }

    setSaving(true)
    try {
      const { added, merged, error } = await addIngredientsToShoppingList({
        supabase,
        userId,
        homeId,
        lines,
        mergeDuplicates,
      })
      if (error) throw error
      onSuccess(
        `Added ${added} item${added !== 1 ? "s" : ""}${merged ? `, merged ${merged}` : ""} to shopping list`,
      )
      onClose()
    } catch (err) {
      onError(getSupabaseErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetModal
      open
      onClose={onClose}
      title="Add to Shopping List"
      footer={
        <ModalSubmitFooter
          formId={formId}
          label="Add Ingredients"
          saving={saving}
          disabled={!canSubmit}
          missing={
            !homeId
              ? ["residence"]
              : selectedCount === 0
                ? ["at least one ingredient"]
                : []
          }
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-stone-500">{dish.name}</p>
        <HomeSelect homes={homes} value={homeId} onChange={setHomeId} />
        <div>
          <label className={ui.label}>Servings (scales quantities)</label>
          <input
            type="number"
            min={1}
            value={servings}
            onChange={(e) =>
              setServings(Math.max(1, Number(e.target.value) || 1))
            }
            className={ui.input}
          />
        </div>
        <IngredientPicker
          lines={lines}
          onChange={setLines}
          mergeDuplicates={mergeDuplicates}
          onMergeChange={setMergeDuplicates}
        />
      </form>
    </SheetModal>
  )
}

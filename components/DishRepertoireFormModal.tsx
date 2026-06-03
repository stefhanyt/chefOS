"use client"

import { useState } from "react"
import SheetModal from "@/components/SheetModal"
import FormField from "@/components/FormField"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import {
  INGREDIENT_CATEGORIES,
  REPERTOIRE_DIETARY_TAGS,
  REPERTOIRE_MEAL_CATEGORIES,
  DEFAULT_REPERTOIRE_MEAL_CATEGORY,
} from "@/lib/repertoire-constants"
import type { DishIngredientInput, DishRepertoireInput } from "@/lib/dish-repertoire"
import { parseLegacyIngredients } from "@/lib/dish-repertoire"
import type { DishLibraryItem } from "@/lib/types"
import { ui } from "@/lib/ui"
import { Plus, Trash2 } from "lucide-react"

function dishToInput(dish?: DishLibraryItem): DishRepertoireInput {
  if (!dish) {
    return {
      name: "",
      description: "",
      meal_category: DEFAULT_REPERTOIRE_MEAL_CATEGORY,
      cuisine_style: "",
      dietary_tags: [],
      instructions: "",
      default_servings: 4,
      is_active: true,
      prep_time: "",
      storage_instructions: "",
      reheating_instructions: "",
      residence_notes: {},
      ingredients: [{ name: "", quantity: 1, unit: "", category: "Other", notes: "" }],
    }
  }
  const ings =
    dish.dish_ingredients?.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: Number(i.quantity) || 1,
      unit: i.unit ?? "",
      category: i.category ?? "Other",
      notes: i.notes ?? "",
    })) ?? parseLegacyIngredients(dish.ingredients)

  return {
    name: dish.name,
    description: dish.description ?? "",
    meal_category:
      dish.meal_category ?? dish.category ?? DEFAULT_REPERTOIRE_MEAL_CATEGORY,
    cuisine_style: dish.cuisine_style ?? "",
    dietary_tags:
      dish.dietary_tags?.length ? dish.dietary_tags : dish.tags ?? [],
    instructions:
      dish.instructions ??
      dish.reheating_instructions ??
      dish.notes ??
      "",
    default_servings: dish.default_servings ?? 4,
    is_active: dish.is_active !== false,
    prep_time: dish.prep_time ?? "",
    storage_instructions: dish.storage_instructions ?? "",
    reheating_instructions: dish.reheating_instructions ?? "",
    residence_notes: (dish.residence_notes as Record<string, string>) ?? {},
    ingredients: ings.length
      ? ings
      : [{ name: "", quantity: 1, unit: "", category: "Other", notes: "" }],
  }
}

export default function DishRepertoireFormModal({
  title,
  quick = false,
  initial,
  onClose,
  onSave,
}: {
  title: string
  quick?: boolean
  initial?: DishLibraryItem
  onClose: () => void
  onSave: (input: DishRepertoireInput) => void | Promise<void>
}) {
  const formId = "dish-repertoire-form"
  const [form, setForm] = useState<DishRepertoireInput>(() => dishToInput(initial))
  const [saving, setSaving] = useState(false)
  const [showMore, setShowMore] = useState(!quick && Boolean(initial))

  const canSubmit = form.name.trim().length > 0 && !saving

  function updateIngredient(index: number, patch: Partial<DishIngredientInput>) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((ing, i) =>
        i === index ? { ...ing, ...patch } : ing,
      ),
    }))
  }

  function addIngredientRow() {
    setForm((f) => ({
      ...f,
      ingredients: [
        ...f.ingredients,
        { name: "", quantity: 1, unit: "", category: "Other", notes: "" },
      ],
    }))
  }

  function removeIngredient(index: number) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.filter((_, i) => i !== index),
    }))
  }

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      dietary_tags: f.dietary_tags.includes(tag)
        ? f.dietary_tags.filter((t) => t !== tag)
        : [...f.dietary_tags, tag],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      await onSave(form)
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
          missing={!form.name.trim() ? ["dish name"] : []}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Dish Name"
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          placeholder="e.g. Herb-Crusted Salmon"
          required
        />

        <div>
          <label className={ui.label}>Repertoire category</label>
          <select
            value={form.meal_category}
            onChange={(e) =>
              setForm((f) => ({ ...f, meal_category: e.target.value }))
            }
            className={ui.input}
          >
            {REPERTOIRE_MEAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {!REPERTOIRE_MEAL_CATEGORIES.includes(
              form.meal_category as (typeof REPERTOIRE_MEAL_CATEGORIES)[number],
            ) &&
              form.meal_category && (
                <option value={form.meal_category}>{form.meal_category}</option>
              )}
          </select>
        </div>

        {!quick && (
          <>
            <FormField
              label="Description"
              value={form.description}
              onChange={(v) => setForm((f) => ({ ...f, description: v }))}
              placeholder="Short summary for clients or staff"
            />
            <FormField
              label="Cuisine / Style (optional)"
              value={form.cuisine_style}
              onChange={(v) => setForm((f) => ({ ...f, cuisine_style: v }))}
              placeholder="e.g. Italian, Comfort food"
            />
          </>
        )}

        {!quick && (
          <div>
            <label className={ui.label}>Dietary Tags</label>
            <div className="flex flex-wrap gap-2">
              {REPERTOIRE_DIETARY_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={
                    form.dietary_tags.includes(tag) ? ui.chipActive : ui.chip
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {!quick && (
          <>
            <div className="flex items-center justify-between gap-3">
              <label className={ui.label}>Ingredients (for shopping list)</label>
              <button
                type="button"
                onClick={addIngredientRow}
                className={`${ui.btnText} text-navy-light`}
              >
                <Plus size={14} />
                Add line
              </button>
            </div>
            <div className="space-y-3">
              {form.ingredients.map((ing, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-stone-200/60 bg-stone-50/40 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-500">
                      Ingredient {idx + 1}
                    </span>
                    {form.ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIngredient(idx)}
                        className={ui.btnIcon}
                        aria-label="Remove ingredient"
                      >
                        <Trash2 size={16} className="text-rose-500" />
                      </button>
                    )}
                  </div>
                  <FormField
                    label="Name"
                    value={ing.name}
                    onChange={(v) => updateIngredient(idx, { name: v })}
                    placeholder="e.g. Salmon fillet"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <FormField
                      label="Qty"
                      value={String(ing.quantity)}
                      onChange={(v) =>
                        updateIngredient(idx, {
                          quantity: Number(v) || 0,
                        })
                      }
                      type="number"
                    />
                    <FormField
                      label="Unit"
                      value={ing.unit}
                      onChange={(v) => updateIngredient(idx, { unit: v })}
                      placeholder="g, cup…"
                    />
                  </div>
                  <div className="mt-2">
                    <label className={ui.label}>Grocery Category</label>
                    <select
                      value={ing.category}
                      onChange={(e) =>
                        updateIngredient(idx, { category: e.target.value })
                      }
                      className={ui.input}
                    >
                      {INGREDIENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!quick && (
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={`${ui.btnText} -ml-2 w-full justify-center text-stone-500`}
          >
            {showMore ? "Fewer options" : "Servings, instructions & status"}
          </button>
        )}

        {showMore && !quick && (
          <>
            <FormField
              label="Default Servings"
              value={String(form.default_servings)}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  default_servings: Math.max(1, Number(v) || 4),
                }))
              }
              type="number"
            />
            <FormField
              label="Instructions / Notes"
              value={form.instructions}
              onChange={(v) => setForm((f) => ({ ...f, instructions: v }))}
              placeholder="Prep steps, plating, client notes…"
            />
            <FormField
              label="Prep Time"
              value={form.prep_time}
              onChange={(v) => setForm((f) => ({ ...f, prep_time: v }))}
              placeholder="e.g. 45 min"
            />
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
                className="h-4 w-4 rounded border-stone-300"
              />
              Active in repertoire
            </label>
          </>
        )}
      </form>
    </SheetModal>
  )
}

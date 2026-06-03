import type { SupabaseClient } from "@supabase/supabase-js"
import { MENU_SLOT_TO_CATEGORY } from "@/lib/repertoire-constants"
import { ensureWeeklyMenu } from "@/lib/supabase/menu-data"
import { getWeekStart } from "@/lib/menu-utils"
import { logSupabaseError } from "@/lib/supabase/errors"
import type { DishIngredient, DishLibraryItem, Home } from "@/lib/types"

export type DishIngredientInput = {
  id?: string
  name: string
  quantity: number
  unit: string
  category: string
  notes: string
}

export type DishRepertoireInput = {
  name: string
  description: string
  meal_category: string
  cuisine_style: string
  dietary_tags: string[]
  instructions: string
  default_servings: number
  is_active: boolean
  prep_time: string
  storage_instructions: string
  reheating_instructions: string
  residence_notes: Record<string, string>
  ingredients: DishIngredientInput[]
}

export function ingredientsToSummaryText(ingredients: DishIngredientInput[]): string {
  return ingredients
    .filter((i) => i.name.trim())
    .map((i) => {
      const qty =
        i.quantity && i.unit
          ? `${i.quantity} ${i.unit}`
          : i.quantity
            ? String(i.quantity)
            : ""
      return [qty, i.name.trim(), i.notes.trim() ? `(${i.notes.trim()})` : ""]
        .filter(Boolean)
        .join(" ")
    })
    .join("\n")
}

export function parseLegacyIngredients(text: string): DishIngredientInput[] {
  if (!text?.trim()) return []
  return text
    .split(/\n+/)
    .map((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) return null
      const match = trimmed.match(/^([\d.,]+)\s*(\S+)?\s+(.+)$/)
      if (match) {
        return {
          name: match[3].trim(),
          quantity: Number(match[1].replace(",", ".")) || 1,
          unit: match[2] ?? "",
          category: "Other",
          notes: "",
        }
      }
      return {
        name: trimmed,
        quantity: 1,
        unit: "",
        category: "Other",
        notes: "",
      }
    })
    .filter((x): x is DishIngredientInput => x !== null)
}

export async function fetchDishWithIngredients(
  supabase: SupabaseClient,
  dishId: string,
): Promise<{ dish: DishLibraryItem | null; ingredients: DishIngredient[]; error: unknown }> {
  const { data: dish, error: dishError } = await supabase
    .from("dish_library")
    .select("*")
    .eq("id", dishId)
    .single()

  if (dishError) return { dish: null, ingredients: [], error: dishError }

  const { data: rows, error: ingError } = await supabase
    .from("dish_ingredients")
    .select("*")
    .eq("dish_id", dishId)
    .order("sort_order", { ascending: true })

  if (ingError) {
    return { dish: dish as DishLibraryItem, ingredients: [], error: ingError }
  }

  let ingredients = (rows as DishIngredient[]) ?? []
  if (ingredients.length === 0 && (dish as DishLibraryItem).ingredients) {
    ingredients = parseLegacyIngredients(
      (dish as DishLibraryItem).ingredients,
    ).map((i, idx) => ({
      id: `legacy-${idx}`,
      dish_id: dishId,
      sort_order: idx,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      category: i.category,
      notes: i.notes,
      created_at: "",
    }))
  }

  return { dish: dish as DishLibraryItem, ingredients, error: null }
}

export async function fetchAllDishesWithIngredients(
  supabase: SupabaseClient,
): Promise<{ data: (DishLibraryItem & { dish_ingredients?: DishIngredient[] })[]; error: unknown }> {
  const { data: dishes, error } = await supabase
    .from("dish_library")
    .select("*, dish_ingredients(*)")
    .is("archived_at", null)
    .order("name", { ascending: true })

  if (error) return { data: [], error }

  const rows = (dishes ?? []).map((d) => {
    const item = d as DishLibraryItem & { dish_ingredients?: DishIngredient[] }
    let ings = item.dish_ingredients ?? []
    if (ings.length === 0 && item.ingredients) {
      ings = parseLegacyIngredients(item.ingredients).map((i, idx) => ({
        id: `legacy-${item.id}-${idx}`,
        dish_id: item.id,
        sort_order: idx,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category,
        notes: i.notes,
        created_at: "",
      }))
    }
    return { ...item, dish_ingredients: ings }
  })

  return { data: rows, error: null }
}

export async function saveDishRepertoire(
  supabase: SupabaseClient,
  userId: string,
  input: DishRepertoireInput,
  dishId?: string,
): Promise<{ dish: DishLibraryItem | null; error: unknown }> {
  const summary = ingredientsToSummaryText(input.ingredients)
  const legacyTags = input.dietary_tags

  const row = {
    name: input.name.trim(),
    description: input.description.trim() || null,
    meal_category: input.meal_category || null,
    category: input.meal_category || "Other",
    cuisine_style: input.cuisine_style.trim() || null,
    dietary_tags: legacyTags,
    tags: legacyTags,
    instructions: input.instructions.trim() || null,
    ingredients: summary,
    prep_time: input.prep_time.trim() || null,
    storage_instructions: input.storage_instructions.trim() || null,
    reheating_instructions: input.reheating_instructions.trim() || null,
    notes: input.instructions.trim() || null,
    default_servings: input.default_servings || 4,
    is_active: input.is_active,
    residence_notes: input.residence_notes,
    updated_at: new Date().toISOString(),
  }

  let savedId = dishId

  if (dishId) {
    const { error } = await supabase
      .from("dish_library")
      .update(row)
      .eq("id", dishId)
    if (error) return { dish: null, error }
  } else {
    const { data, error } = await supabase
      .from("dish_library")
      .insert({ ...row, created_by: userId })
      .select("*")
      .single()
    if (error) return { dish: null, error }
    savedId = data.id
  }

  if (!savedId) return { dish: null, error: new Error("No dish id") }

  await supabase.from("dish_ingredients").delete().eq("dish_id", savedId)

  const toInsert = input.ingredients
    .filter((i) => i.name.trim())
    .map((i, idx) => ({
      dish_id: savedId,
      sort_order: idx,
      name: i.name.trim(),
      quantity: i.quantity || 1,
      unit: i.unit.trim() || null,
      category: i.category.trim() || "Other",
      notes: i.notes.trim() || null,
    }))

  if (toInsert.length > 0) {
    const { error: ingError } = await supabase
      .from("dish_ingredients")
      .insert(toInsert)
    if (ingError) return { dish: null, error: ingError }
  }

  const { data: dish, error: loadError } = await supabase
    .from("dish_library")
    .select("*")
    .eq("id", savedId)
    .single()

  return { dish: (dish as DishLibraryItem) ?? null, error: loadError }
}

export async function addDishToWeeklyMenu(opts: {
  supabase: SupabaseClient
  userId: string
  homeId: string
  dish: DishLibraryItem
  dayOfWeek: number
  menuCategory: string
  portions: number
  notes?: string
  weekOffset?: number
}): Promise<{ error: unknown }> {
  const weekStart = getWeekStart(opts.weekOffset ?? 0)
  const { menuId, error: menuError } = await ensureWeeklyMenu(
    opts.supabase,
    opts.homeId,
    weekStart,
    opts.userId,
  )
  if (menuError || !menuId) return { error: menuError ?? new Error("No menu") }

  const menuCat =
    MENU_SLOT_TO_CATEGORY[opts.menuCategory] ?? opts.menuCategory ?? "Mains"

  const { error } = await opts.supabase.from("menu_items").insert({
    menu_id: menuId,
    day_of_week: opts.dayOfWeek,
    category: menuCat,
    dish_id: opts.dish.id,
    dish_name: opts.dish.name,
    portions: opts.portions,
    notes: opts.notes?.trim() || null,
  })

  return { error: error ?? null }
}

export async function addDishToResidenceMealLog(opts: {
  supabase: SupabaseClient
  userId: string
  homeId: string
  dish: DishLibraryItem
  portions: number
  preparedDate: string
  expiryDate: string
  storageLocation: string
}): Promise<{ error: unknown }> {
  const { error } = await opts.supabase.from("prepared_meals").insert({
    home_id: opts.homeId,
    dish_id: opts.dish.id,
    created_by: opts.userId,
    name: opts.dish.name,
    prepared_date: opts.preparedDate,
    expiry_date: opts.expiryDate,
    portions: opts.portions,
    storage_location: opts.storageLocation,
    reheating_instructions: opts.dish.reheating_instructions ?? "",
    notes: opts.dish.description ?? opts.dish.instructions ?? null,
    status: "Fresh",
  })
  return { error: error ?? null }
}

export type ShoppingIngredientLine = {
  ingredient: DishIngredient
  scaledQuantity: number
  selected: boolean
}

export function scaleIngredients(
  ingredients: DishIngredient[],
  defaultServings: number,
  targetServings: number,
): ShoppingIngredientLine[] {
  const base = defaultServings > 0 ? defaultServings : 4
  const factor = targetServings / base
  return ingredients.map((ing) => ({
    ingredient: ing,
    scaledQuantity: Math.round((ing.quantity || 1) * factor * 100) / 100,
    selected: true,
  }))
}

export type ShoppingDuplicate = {
  existingId: string
  existingQty: string
  ingredientName: string
}

export async function findShoppingDuplicate(
  supabase: SupabaseClient,
  homeId: string,
  name: string,
): Promise<ShoppingDuplicate | null> {
  const { data } = await supabase
    .from("shopping_items")
    .select("id, name, quantity_needed")
    .eq("home_id", homeId)
    .eq("status", "Open")
    .is("archived_at", null)
    .ilike("name", name.trim())

  if (!data?.[0]) return null
  return {
    existingId: data[0].id,
    existingQty: data[0].quantity_needed ?? "",
    ingredientName: data[0].name,
  }
}

export async function addIngredientsToShoppingList(opts: {
  supabase: SupabaseClient
  userId: string
  homeId: string
  lines: ShoppingIngredientLine[]
  mergeDuplicates: boolean
}): Promise<{ added: number; merged: number; error: unknown }> {
  let added = 0
  let merged = 0

  for (const line of opts.lines) {
    if (!line.selected || !line.ingredient.name.trim()) continue

    const name = line.ingredient.name.trim()
    const qtyStr = [
      line.scaledQuantity,
      line.ingredient.unit?.trim(),
    ]
      .filter(Boolean)
      .join(" ")

    const duplicate = await findShoppingDuplicate(
      opts.supabase,
      opts.homeId,
      name,
    )

    if (duplicate && opts.mergeDuplicates) {
      const combined = [duplicate.existingQty, qtyStr]
        .filter(Boolean)
        .join(" + ")
      const { error } = await opts.supabase
        .from("shopping_items")
        .update({ quantity_needed: combined })
        .eq("id", duplicate.existingId)
      if (error) {
        logSupabaseError("shopping merge", error)
        return { added, merged, error }
      }
      merged++
      continue
    }

    const { error } = await opts.supabase.from("shopping_items").insert({
      home_id: opts.homeId,
      name,
      quantity_needed: qtyStr || "1",
      category: line.ingredient.category?.trim() || "Other",
      priority: "Normal",
      status: "Open",
      added_by: opts.userId,
      notes: line.ingredient.notes?.trim() || null,
    })

    if (error) {
      logSupabaseError("shopping insert from repertoire", error)
      return { added, merged, error }
    }
    added++
  }

  return { added, merged, error: null }
}

export async function loadHomesForRepertoire(
  supabase: SupabaseClient,
): Promise<Home[]> {
  const { data } = await supabase
    .from("homes")
    .select("id, name, location, owner_id")
    .is("archived_at", null)
    .order("name")
  return (data as Home[]) ?? []
}

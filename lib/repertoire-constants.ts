/** Dish Repertoire categories (private chef workflow). Stored in dish_library.meal_category. */
export const REPERTOIRE_MEAL_CATEGORIES = [
  "Main Dish",
  "Side Dish",
  "Sauce",
  "Dressing",
  "Soup",
  "Salad",
  "Dessert",
  "Breakfast",
  "Snack",
  "Prep Item",
  "Other",
] as const

export type RepertoireMealCategory = (typeof REPERTOIRE_MEAL_CATEGORIES)[number]

/** Maps repertoire category → weekly menu column (Mains, Sides, …). Includes legacy labels. */
export const MENU_SLOT_TO_CATEGORY: Record<string, string> = {
  "Main Dish": "Mains",
  "Side Dish": "Sides",
  Sauce: "Sauces & Condiments",
  Dressing: "Sauces & Condiments",
  Soup: "Soups",
  Salad: "Sides",
  Dessert: "Desserts",
  Breakfast: "Mains",
  Snack: "Sides",
  "Prep Item": "Sauces & Condiments",
  Other: "Mains",
  // legacy rows (pre–category refresh)
  Lunch: "Mains",
  Dinner: "Mains",
  Prep: "Sauces & Condiments",
}

/** Filter chips: match stored meal_category / category, including legacy aliases. */
const REPERTOIRE_CATEGORY_FILTER_ALIASES: Record<
  RepertoireMealCategory,
  readonly string[]
> = {
  "Main Dish": ["Main Dish", "Dinner", "Lunch"],
  "Side Dish": ["Side Dish"],
  Sauce: ["Sauce"],
  Dressing: ["Dressing"],
  Soup: ["Soup"],
  Salad: ["Salad"],
  Dessert: ["Dessert"],
  Breakfast: ["Breakfast"],
  Snack: ["Snack"],
  "Prep Item": ["Prep Item", "Prep"],
  Other: ["Other"],
}

export function dishRepertoireCategoryLabel(dish: {
  meal_category?: string | null
  category?: string | null
}): string {
  return (dish.meal_category ?? dish.category ?? "").trim()
}

export function dishMatchesRepertoireCategory(
  dish: { meal_category?: string | null; category?: string | null },
  filterCategory: string,
): boolean {
  const value = dishRepertoireCategoryLabel(dish).toLowerCase()
  if (!value) return filterCategory === "Other"
  const aliases =
    REPERTOIRE_CATEGORY_FILTER_ALIASES[
      filterCategory as RepertoireMealCategory
    ] ?? [filterCategory]
  return aliases.some((a) => a.toLowerCase() === value)
}

export const REPERTOIRE_DIETARY_TAGS = [
  "Vegetarian",
  "Gluten-free",
  "Dairy-free",
  "High protein",
  "Kid-friendly",
] as const

export const INGREDIENT_CATEGORIES = [
  "Produce",
  "Dairy",
  "Dry Goods",
  "Meat & Seafood",
  "Frozen",
  "Canned Goods",
  "Spices",
  "Oils & Vinegars",
  "Bakery",
  "Cleaning",
  "Other",
] as const

export const DEFAULT_REPERTOIRE_MEAL_CATEGORY: RepertoireMealCategory =
  "Main Dish"

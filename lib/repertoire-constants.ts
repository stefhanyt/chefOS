export const REPERTOIRE_MEAL_CATEGORIES = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
  "Dessert",
  "Prep",
] as const

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

export const MENU_SLOT_TO_CATEGORY: Record<string, string> = {
  Breakfast: "Mains",
  Lunch: "Mains",
  Dinner: "Mains",
  Snack: "Sides",
  Dessert: "Desserts",
  Prep: "Sauces & Condiments",
}

import type { DishLibraryItem } from "@/lib/types"

export function filterDishesForMenu(
  dishes: DishLibraryItem[],
  query: string,
  menuCategory: string,
): DishLibraryItem[] {
  const q = query.trim().toLowerCase()
  const cat = menuCategory.trim().toLowerCase()

  let list = dishes
  if (q) {
    list = dishes.filter((d) => {
      const tags = Array.isArray(d.tags) ? d.tags : []
      return (
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        tags.some((t) => String(t).toLowerCase().includes(q))
      )
    })
  }

  return [...list].sort((a, b) => {
    const aCat = a.category.trim().toLowerCase() === cat
    const bCat = b.category.trim().toLowerCase() === cat
    if (aCat !== bCat) return aCat ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function isDishAlreadyOnMenu(
  entries: { dish: string; dish_id?: string | null }[],
  dish: DishLibraryItem,
): boolean {
  return entries.some(
    (e) =>
      (dish.id && e.dish_id === dish.id) ||
      e.dish.trim().toLowerCase() === dish.name.trim().toLowerCase(),
  )
}

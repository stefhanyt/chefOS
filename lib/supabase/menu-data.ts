import type { SupabaseClient } from "@supabase/supabase-js"
import type { MenuItemRow } from "@/lib/types"

export interface MenuDishEntry {
  id: string
  dish: string
  dish_id?: string | null
  portions: number
  notes: string
}

export type DayMenu = Record<string, MenuDishEntry[]>
export type WeekMenu = Record<number, DayMenu>

export function buildWeekMenuFromItems(rows: MenuItemRow[]): WeekMenu {
  const menu: WeekMenu = {}
  for (const row of rows) {
    if (!menu[row.day_of_week]) menu[row.day_of_week] = {}
    if (!menu[row.day_of_week][row.category]) {
      menu[row.day_of_week][row.category] = []
    }
    menu[row.day_of_week][row.category].push({
      id: row.id,
      dish: row.dish_name,
      dish_id: row.dish_id,
      portions: row.portions,
      notes: row.notes ?? "",
    })
  }
  return menu
}

export async function ensureWeeklyMenu(
  supabase: SupabaseClient,
  homeId: string,
  weekStart: string,
  userId: string,
): Promise<{ menuId: string | null; error: unknown }> {
  const { data: existing } = await supabase
    .from("weekly_menus")
    .select("id")
    .eq("home_id", homeId)
    .eq("week_start", weekStart)
    .maybeSingle()

  if (existing?.id) return { menuId: existing.id, error: null }

  const { data, error } = await supabase
    .from("weekly_menus")
    .insert({
      home_id: homeId,
      week_start: weekStart,
      status: "draft",
      created_by: userId,
    })
    .select("id")
    .single()

  if (error) return { menuId: null, error }
  return { menuId: data.id, error: null }
}

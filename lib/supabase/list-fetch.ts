import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  BarcodeScan,
  DishLibraryItem,
  Home,
  MenuItemRow,
  PantryItem,
  PreparedMeal,
  ShoppingItem,
} from "@/lib/types"
import { computeMealStatus, computePantryStatus } from "@/lib/pantry-utils"
import { logSupabaseError } from "@/lib/supabase/errors"

/** Log fetch counts and client-side filter stats while debugging list issues */
export function logListFetch(
  table: string,
  meta: {
    rawCount?: number
    afterNormalize?: number
    error?: unknown
    note?: string
    filters?: Record<string, unknown>
  },
) {
  if (process.env.NODE_ENV === "production") return
  const { error, ...rest } = meta
  console.log(`[chefOS list] ${table}`, {
    ...rest,
    error: error ? String(error) : undefined,
  })
}

export function logClientFilter(
  table: string,
  before: number,
  after: number,
  activeFilters: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === "production") return
  if (before === after) return
  console.log(`[chefOS filter] ${table}`, { before, after, activeFilters })
}

type RowWithHome = { home_id: string; home?: Home | null }

export function attachHomes<T extends RowWithHome>(
  rows: T[],
  homes: Home[],
): T[] {
  if (homes.length === 0) return rows
  const byId = new Map(homes.map((h) => [h.id, h]))
  return rows.map((row) => ({
    ...row,
    home: byId.get(row.home_id) ?? row.home ?? undefined,
  }))
}

async function runSelect<T>(
  supabase: SupabaseClient,
  table: string,
  run: () => PromiseLike<{ data: T[] | null; error: unknown }>,
  fallback: () => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const primary = await run()
  if (!primary.error && primary.data) {
    logListFetch(table, { rawCount: primary.data.length, note: "primary select" })
    return { data: primary.data, error: null }
  }

  if (primary.error) {
    logSupabaseError(`${table} list (primary)`, primary.error)
    logListFetch(table, { rawCount: 0, error: primary.error, note: "primary failed, trying fallback" })
  }

  const second = await fallback()
  if (second.error) {
    logSupabaseError(`${table} list (fallback)`, second.error)
    logListFetch(table, { rawCount: 0, error: second.error, note: "fallback failed" })
    return { data: [], error: second.error }
  }

  const data = second.data ?? []
  logListFetch(table, { rawCount: data.length, note: "fallback select (*)" })
  return { data, error: null }
}

function normalizePantryRows(rows: PantryItem[]): PantryItem[] {
  return rows.map((row) => ({
    ...row,
    status: computePantryStatus(row.quantity, row.minimum_quantity ?? 0),
  }))
}

function normalizeMealRows(rows: PreparedMeal[]): PreparedMeal[] {
  return rows.map((row) => ({
    ...row,
    status: row.expiry_date
      ? computeMealStatus(row.expiry_date)
      : row.status,
  }))
}

export async function fetchPantryItems(
  supabase: SupabaseClient,
  homes: Home[] = [],
): Promise<{ data: PantryItem[]; error: unknown }> {
  const embed =
    "*, home:homes(id, name, location)"

  const { data, error } = await runSelect<PantryItem>(
    supabase,
    "pantry_items",
    () =>
      supabase
        .from("pantry_items")
        .select(embed)
        .is("archived_at", null)
        .order("name", { ascending: true }),
    () =>
      supabase
        .from("pantry_items")
        .select("*")
        .is("archived_at", null)
        .order("name", { ascending: true }),
  )

  const attached = attachHomes(data, homes)
  const normalized = normalizePantryRows(attached)
  logListFetch("pantry_items", {
    rawCount: data.length,
    afterNormalize: normalized.length,
    filters: { archived_at: null },
  })
  return { data: normalized, error }
}

export async function fetchPreparedMeals(
  supabase: SupabaseClient,
  homes: Home[] = [],
): Promise<{ data: PreparedMeal[]; error: unknown }> {
  const embed = "*, home:homes(id, name, location)"

  const { data, error } = await runSelect<PreparedMeal>(
    supabase,
    "prepared_meals",
    () =>
      supabase
        .from("prepared_meals")
        .select(embed)
        .is("archived_at", null)
        .order("expiry_date", { ascending: true }),
    () =>
      supabase
        .from("prepared_meals")
        .select("*")
        .is("archived_at", null)
        .order("expiry_date", { ascending: true }),
  )

  const attached = attachHomes(data, homes)
  const normalized = normalizeMealRows(attached)
  logListFetch("prepared_meals", {
    rawCount: data.length,
    afterNormalize: normalized.length,
    filters: { archived_at: null },
  })
  return { data: normalized, error }
}

export async function fetchShoppingItems(
  supabase: SupabaseClient,
  homes: Home[] = [],
): Promise<{ data: ShoppingItem[]; error: unknown }> {
  const plain = () =>
    supabase
      .from("shopping_items")
      .select("*")
      .is("archived_at", null)
      .in("status", ["Open", "Purchased"])
      .order("created_at", { ascending: false })

  const { data, error } = await runSelect<ShoppingItem>(
    supabase,
    "shopping_items",
    () =>
      supabase
        .from("shopping_items")
        .select(
          "*, home:homes(id, name, location), added_by_profile:profiles!added_by(id, display_name, email)",
        )
        .is("archived_at", null)
        .in("status", ["Open", "Purchased"])
        .order("created_at", { ascending: false }),
    plain,
  )

  const attached = attachHomes(data, homes)
  logListFetch("shopping_items", {
    rawCount: attached.length,
    filters: { archived_at: null, status: ["Open", "Purchased"] },
  })
  return { data: attached, error }
}

/** Fetch one shopping row after realtime / insert (plain select, no profile join). */
export async function fetchShoppingItemById(
  supabase: SupabaseClient,
  id: string,
  homes: Home[] = [],
): Promise<ShoppingItem | null> {
  const { data, error } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle()

  if (error || !data) {
    logListFetch("shopping_items", { rawCount: 0, error, note: `byId ${id}` })
    return null
  }
  const [row] = attachHomes([data as ShoppingItem], homes)
  return row
}

export async function fetchDishLibrary(
  supabase: SupabaseClient,
): Promise<{ data: DishLibraryItem[]; error: unknown }> {
  const { data, error } = await supabase
    .from("dish_library")
    .select("*")
    .is("archived_at", null)
    .order("name", { ascending: true })

  if (error) {
    logListFetch("dish_library", { rawCount: 0, error })
    return { data: [], error }
  }

  const rows = (data as DishLibraryItem[]) ?? []
  logListFetch("dish_library", {
    rawCount: rows.length,
    filters: { archived_at: null },
  })
  return { data: rows, error: null }
}

export async function fetchBarcodeScans(
  supabase: SupabaseClient,
  homes: Home[] = [],
): Promise<{ data: (BarcodeScan & { home?: Home })[]; error: unknown }> {
  const { data, error } = await runSelect<BarcodeScan & { home?: Home }>(
    supabase,
    "barcode_scans",
    () =>
      supabase
        .from("barcode_scans")
        .select("*, home:homes(id, name)")
        .order("created_at", { ascending: false })
        .limit(100),
    () =>
      supabase
        .from("barcode_scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
  )

  const attached = attachHomes(data, homes)
  logListFetch("barcode_scans", { rawCount: attached.length })
  return { data: attached, error }
}

export async function fetchMenuItems(
  supabase: SupabaseClient,
  menuId: string,
): Promise<{ data: MenuItemRow[]; error: unknown }> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("menu_id", menuId)
    .order("day_of_week", { ascending: true })
    .order("category", { ascending: true })

  if (error) {
    logListFetch("menu_items", { rawCount: 0, error, filters: { menu_id: menuId } })
    return { data: [], error }
  }

  const rows = (data as MenuItemRow[]) ?? []
  logListFetch("menu_items", {
    rawCount: rows.length,
    filters: { menu_id: menuId },
  })
  return { data: rows, error: null }
}

export function mergeById<T extends { id: string }>(prev: T[], row: T): T[] {
  if (prev.some((i) => i.id === row.id)) return prev
  return [row, ...prev]
}

/** Insert/update return row: prefer plain select, optional home attach */
export async function fetchRowById<T extends { id: string }>(
  supabase: SupabaseClient,
  table: "pantry_items" | "prepared_meals" | "shopping_items" | "dish_library",
  id: string,
): Promise<T | null> {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle()
  if (error) {
    logSupabaseError(`${table} fetchRowById`, error)
    return null
  }
  return (data as T) ?? null
}

import type { SupabaseClient } from "@supabase/supabase-js"
import type { PantryItem, PantryStatus } from "@/lib/types"
import { computePantryStatus } from "@/lib/pantry-utils"
import { logSupabaseError } from "@/lib/supabase/errors"

export type PantryItemInput = {
  name: string
  quantity: number
  unit: string
  category: string
  storage_location: string
  minimum_quantity: number
  home_id: string
}

const PANTRY_SELECT = "*, home:homes(id, name, location)"

export function buildPantryInsertPayload(
  input: PantryItemInput,
  userId: string,
): Record<string, unknown> {
  const quantity = Number.isFinite(input.quantity) ? input.quantity : 0
  const minimum_quantity = Number.isFinite(input.minimum_quantity)
    ? input.minimum_quantity
    : 0

  return {
    home_id: input.home_id,
    created_by: userId,
    name: input.name.trim(),
    category: input.category.trim() || "General",
    quantity,
    unit: input.unit.trim() || "each",
    minimum_quantity,
    storage_location: input.storage_location.trim() || "Pantry",
    status: computePantryStatus(quantity, minimum_quantity),
    notes: null,
    barcode: null,
    preferred_brand: null,
  }
}

export function buildPantryUpdatePayload(
  input: PantryItemInput,
): Record<string, unknown> {
  const quantity = Number.isFinite(input.quantity) ? input.quantity : 0
  const minimum_quantity = Number.isFinite(input.minimum_quantity)
    ? input.minimum_quantity
    : 0

  return {
    home_id: input.home_id,
    name: input.name.trim(),
    category: input.category.trim() || "General",
    quantity,
    unit: input.unit.trim() || "each",
    minimum_quantity,
    storage_location: input.storage_location.trim() || "Pantry",
    status: computePantryStatus(quantity, minimum_quantity),
    updated_at: new Date().toISOString(),
  }
}

export async function insertPantryItem(
  supabase: SupabaseClient,
  input: PantryItemInput,
  userId: string,
): Promise<{ data: PantryItem | null; error: unknown }> {
  const row = buildPantryInsertPayload(input, userId)

  const { data, error } = await supabase
    .from("pantry_items")
    .insert(row)
    .select(PANTRY_SELECT)
    .single()

  if (!error && data) {
    return { data: data as PantryItem, error: null }
  }

  if (error) {
    logSupabaseError("pantry insert (with select)", error)
  }

  // Insert may succeed even if returning row fails (RLS on select) — verify
  const { data: fallback, error: fallbackError } = await supabase
    .from("pantry_items")
    .select(PANTRY_SELECT)
    .eq("home_id", input.home_id)
    .eq("name", row.name as string)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fallback) {
    return { data: fallback as PantryItem, error: null }
  }

  return { data: null, error: error ?? fallbackError }
}

export async function updatePantryItem(
  supabase: SupabaseClient,
  id: string,
  input: PantryItemInput,
): Promise<{ data: PantryItem | null; error: unknown }> {
  const { data, error } = await supabase
    .from("pantry_items")
    .update(buildPantryUpdatePayload(input))
    .eq("id", id)
    .select(PANTRY_SELECT)
    .single()

  return { data: (data as PantryItem) ?? null, error }
}

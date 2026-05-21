import {
  matchesPrefix,
  normalizeName,
  pickMode,
  scoreSuggestion,
} from "@/lib/suggestions/aggregate"

export type PantryHistoryRow = {
  name: string
  unit?: string | null
  category?: string | null
  storage_location?: string | null
  minimum_quantity?: number | null
  home_id?: string | null
  updated_at?: string | null
}

export type PantryNameSuggestion = {
  /** Display casing (most recent entry) */
  name: string
  count: number
  unit: string
  category: string
  storage_location: string
  minimum_quantity: number
}

type Bucket = {
  displayName: string
  count: number
  globalUnits: Map<string, number>
  globalCategories: Map<string, number>
  globalLocations: Map<string, number>
  globalMinQty: Map<string, number>
  homeUnits: Map<string, number>
  homeCategories: Map<string, number>
  homeLocations: Map<string, number>
  homeMinQty: Map<string, number>
}

function bump(map: Map<string, number>, value: string | null | undefined) {
  const v = (value ?? "").trim()
  if (!v) return
  map.set(v, (map.get(v) ?? 0) + 1)
}

function bumpNum(map: Map<string, number>, value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return
  const key = String(value)
  map.set(key, (map.get(key) ?? 0) + 1)
}

export function buildPantrySuggestions(rows: PantryHistoryRow[]): PantryNameSuggestion[] {
  const buckets = new Map<string, Bucket>()

  for (const row of rows) {
    const key = normalizeName(row.name)
    if (!key) continue

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        displayName: row.name.trim(),
        count: 0,
        globalUnits: new Map(),
        globalCategories: new Map(),
        globalLocations: new Map(),
        globalMinQty: new Map(),
        homeUnits: new Map(),
        homeCategories: new Map(),
        homeLocations: new Map(),
        homeMinQty: new Map(),
      }
      buckets.set(key, bucket)
    }

    bucket.count += 1
    if (row.name?.trim()) bucket.displayName = row.name.trim()

    bump(bucket.globalUnits, row.unit)
    bump(bucket.globalCategories, row.category)
    bump(bucket.globalLocations, row.storage_location)
    bumpNum(bucket.globalMinQty, row.minimum_quantity)

    if (row.home_id) {
      bump(bucket.homeUnits, row.unit)
      bump(bucket.homeCategories, row.category)
      bump(bucket.homeLocations, row.storage_location)
      bumpNum(bucket.homeMinQty, row.minimum_quantity)
    }
  }

  const result: PantryNameSuggestion[] = Array.from(buckets.values()).map(
    (bucket) => ({
      name: bucket.displayName,
      count: bucket.count,
      unit: pickMode(bucket.globalUnits),
      category: pickMode(bucket.globalCategories),
      storage_location: pickMode(bucket.globalLocations),
      minimum_quantity: Number(pickMode(bucket.globalMinQty)) || 0,
    }),
  )

  return result.sort((a, b) => b.count - a.count)
}

export function filterPantrySuggestions(
  query: string,
  suggestions: PantryNameSuggestion[],
  limit = 8,
): PantryNameSuggestion[] {
  const q = query.trim()
  if (!q) {
    return suggestions.slice(0, limit)
  }

  return suggestions
    .filter((s) => matchesPrefix(q, s.name))
    .sort(
      (a, b) =>
        scoreSuggestion(q, b.name, b.count) - scoreSuggestion(q, a.name, a.count),
    )
    .slice(0, limit)
}

export function getPantryProfileForName(
  name: string,
  homeId: string | undefined,
  rows: PantryHistoryRow[],
): Omit<PantryNameSuggestion, "name" | "count"> | null {
  const key = normalizeName(name)
  if (!key) return null

  const matching = rows.filter((r) => normalizeName(r.name) === key)
  if (matching.length === 0) return null

  const scoped = homeId
    ? matching.filter((r) => r.home_id === homeId)
    : matching
  const source = scoped.length > 0 ? scoped : matching

  const units = new Map<string, number>()
  const categories = new Map<string, number>()
  const locations = new Map<string, number>()
  const minQty = new Map<string, number>()

  for (const row of source) {
    bump(units, row.unit)
    bump(categories, row.category)
    bump(locations, row.storage_location)
    bumpNum(minQty, row.minimum_quantity)
  }

  return {
    unit: pickMode(units),
    category: pickMode(categories),
    storage_location: pickMode(locations),
    minimum_quantity: Number(pickMode(minQty)) || 0,
  }
}

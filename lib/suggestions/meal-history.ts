import {
  matchesPrefix,
  normalizeName,
  pickMode,
  scoreSuggestion,
} from "@/lib/suggestions/aggregate"

export type MealHistoryRow = {
  name: string
  storage_location?: string | null
  reheating_instructions?: string | null
  portions?: number | null
  prepared_date?: string | null
  expiry_date?: string | null
  home_id?: string | null
  source: "meal" | "dish"
}

export type MealNameSuggestion = {
  name: string
  count: number
  storage_location: string
  reheating_instructions: string
  portions: number
  /** Typical days from prepared → expiry (median-ish via mode bucket) */
  shelf_life_days: number | null
}

type Bucket = {
  displayName: string
  count: number
  locations: Map<string, number>
  reheating: Map<string, number>
  portions: Map<string, number>
  shelfDays: Map<string, number>
}

function bump(map: Map<string, number>, value: string | null | undefined) {
  const v = (value ?? "").trim()
  if (!v) return
  map.set(v, (map.get(v) ?? 0) + 1)
}

function bumpNum(map: Map<string, number>, value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return
  const key = String(Math.round(value))
  map.set(key, (map.get(key) ?? 0) + 1)
}

function shelfLifeDays(prep?: string | null, expiry?: string | null): number | null {
  if (!prep || !expiry) return null
  const a = new Date(prep)
  const b = new Date(expiry)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  const days = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
  return days >= 0 ? days : null
}

export function buildMealSuggestions(rows: MealHistoryRow[]): MealNameSuggestion[] {
  const buckets = new Map<string, Bucket>()

  for (const row of rows) {
    const key = normalizeName(row.name)
    if (!key) continue

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        displayName: row.name.trim(),
        count: 0,
        locations: new Map(),
        reheating: new Map(),
        portions: new Map(),
        shelfDays: new Map(),
      }
      buckets.set(key, bucket)
    }

    bucket.count += 1
    if (row.name?.trim()) bucket.displayName = row.name.trim()

    bump(bucket.locations, row.storage_location)
    bump(bucket.reheating, row.reheating_instructions)
    bumpNum(bucket.portions, row.portions)

    const days = shelfLifeDays(row.prepared_date, row.expiry_date)
    if (days != null) bumpNum(bucket.shelfDays, days)
  }

  const result: MealNameSuggestion[] = Array.from(buckets.values()).map(
    (bucket) => {
      const shelf = pickMode(bucket.shelfDays)
      return {
        name: bucket.displayName,
        count: bucket.count,
        storage_location: pickMode(bucket.locations),
        reheating_instructions: pickMode(bucket.reheating),
        portions: Number(pickMode(bucket.portions)) || 2,
        shelf_life_days: shelf ? Number(shelf) : null,
      }
    },
  )

  return result.sort((a, b) => b.count - a.count)
}

export function filterMealSuggestions(
  query: string,
  suggestions: MealNameSuggestion[],
  limit = 8,
): MealNameSuggestion[] {
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

export function getMealProfileForName(
  name: string,
  homeId: string | undefined,
  rows: MealHistoryRow[],
): Omit<MealNameSuggestion, "name" | "count"> | null {
  const key = normalizeName(name)
  if (!key) return null

  const matching = rows.filter((r) => normalizeName(r.name) === key)
  if (matching.length === 0) return null

  const scoped = homeId
    ? matching.filter((r) => !r.home_id || r.home_id === homeId)
    : matching
  const source = scoped.length > 0 ? scoped : matching

  return buildMealSuggestions(source)[0] ?? null
}

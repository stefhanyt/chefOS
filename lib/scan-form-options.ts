/** Pantry categories for barcode scan forms */
export const SCAN_CATEGORIES = [
  "Oils & Vinegars",
  "Dairy",
  "Produce",
  "Dry Goods",
  "Canned Goods",
  "Spices",
  "Meat & Seafood",
  "Frozen",
  "Bakery",
  "Cleaning",
  "Other",
] as const

export type ScanCategory = (typeof SCAN_CATEGORIES)[number]

export const SCAN_UNIT_SUGGESTIONS = [
  "unit",
  "bottle",
  "can",
  "jar",
  "pack",
  "box",
  "bag",
  "dozen",
  "g",
  "kg",
  "ml",
  "L",
] as const

export function isScanCategory(value: string): value is ScanCategory {
  return (SCAN_CATEGORIES as readonly string[]).includes(value)
}

/** Maps stored category to select + optional custom label when not in the list. */
export function splitCategoryForSelect(category: string): {
  select: ScanCategory
  custom: string
} {
  if (isScanCategory(category)) {
    return { select: category, custom: "" }
  }
  return { select: "Other", custom: category }
}

export function mergeCategoryFromSelect(
  select: string,
  custom: string,
): string {
  if (select !== "Other") return select
  return custom.trim() || "Other"
}

/** Display value for quantity inputs — never empty or zero. */
export function normalizeScanQuantityDisplay(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return "1"
  const n = Number(trimmed.replace(",", "."))
  if (Number.isNaN(n) || n <= 0) return "1"
  return trimmed
}

/** Persisted pantry/catalog quantity (minimum 1). */
export function parseScanQuantityForSave(value: string): number {
  const n = Number(normalizeScanQuantityDisplay(value).replace(",", "."))
  return Number.isNaN(n) || n <= 0 ? 1 : n
}

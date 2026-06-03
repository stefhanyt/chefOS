import type { SupabaseClient } from "@supabase/supabase-js"
import { lookupBarcode, parseProductName } from "@/lib/openfoodfacts"
import { logSupabaseError } from "@/lib/supabase/errors"
import type { OpenFoodFactsProduct, ProductCatalog } from "@/lib/types"

export type ProductLookupSource = "catalog" | "openfoodfacts" | "manual"

export const LOOKUP_SOURCE_MESSAGES: Record<ProductLookupSource, string> = {
  catalog: "Found in your ChefOS catalog",
  openfoodfacts: "Found via Open Food Facts",
  manual: "Product not found — add manually",
}

export type ScannedProductFields = {
  productName: string
  brand: string
  quantity: string
  unit: string
  category: string
  notes: string
}

export type ProductLookupResult = {
  source: ProductLookupSource
  barcode: string
  fields: ScannedProductFields
}

export function emptyScannedProductFields(): ScannedProductFields {
  return {
    productName: "",
    brand: "",
    quantity: "",
    unit: "",
    category: "Other",
    notes: "",
  }
}

function catalogToFields(row: ProductCatalog): ScannedProductFields {
  return {
    productName: row.product_name ?? "",
    brand: row.brand ?? "",
    quantity:
      row.default_quantity != null ? String(row.default_quantity) : "",
    unit: row.default_unit ?? "",
    category: row.default_category ?? "Other",
    notes: row.notes ?? "",
  }
}

function parseOffQuantity(quantityStr?: string): { quantity: string; unit: string } {
  if (!quantityStr?.trim()) return { quantity: "", unit: "" }
  const match = quantityStr.trim().match(/^([\d.,]+)\s*(.*)$/i)
  if (!match) return { quantity: "", unit: quantityStr.trim() }
  return {
    quantity: match[1].replace(",", "."),
    unit: (match[2] ?? "").trim(),
  }
}

function offToFields(product: OpenFoodFactsProduct): ScannedProductFields {
  const { quantity, unit } = parseOffQuantity(product.quantity)
  const category =
    product.categories?.split(",")[0]?.trim() || "Other"
  return {
    productName: parseProductName(product),
    brand: product.brands?.split(",")[0]?.trim() ?? "",
    quantity,
    unit,
    category,
    notes: "",
  }
}

/**
 * Resolve a barcode: ChefOS catalog (per user) → Open Food Facts → manual entry.
 */
export async function resolveBarcodeProduct(
  supabase: SupabaseClient,
  barcode: string,
  userId: string,
): Promise<ProductLookupResult> {
  const normalized = barcode.trim()
  if (!normalized) {
    return {
      source: "manual",
      barcode: "",
      fields: emptyScannedProductFields(),
    }
  }

  const { data: catalog, error: catalogError } = await supabase
    .from("product_catalog")
    .select("*")
    .eq("barcode", normalized)
    .eq("created_by", userId)
    .maybeSingle()

  if (catalogError) {
    logSupabaseError("product_catalog lookup", catalogError)
  }

  if (catalog) {
    return {
      source: "catalog",
      barcode: normalized,
      fields: catalogToFields(catalog as ProductCatalog),
    }
  }

  const offProduct = await lookupBarcode(normalized)
  if (offProduct) {
    return {
      source: "openfoodfacts",
      barcode: normalized,
      fields: offToFields(offProduct),
    }
  }

  return {
    source: "manual",
    barcode: normalized,
    fields: emptyScannedProductFields(),
  }
}

export type ProductCatalogSaveInput = ScannedProductFields & {
  barcode: string
}

/** Remember product for this user so the next scan skips Open Food Facts. */
export async function upsertProductCatalog(
  supabase: SupabaseClient,
  userId: string,
  input: ProductCatalogSaveInput,
): Promise<{ error: unknown }> {
  const barcode = input.barcode.trim()
  if (!barcode || !input.productName.trim()) {
    return { error: null }
  }

  const qty = input.quantity.trim()
  const defaultQuantity = qty.length > 0 ? Number(qty) : null

  const { error } = await supabase.from("product_catalog").upsert(
    {
      barcode,
      product_name: input.productName.trim(),
      brand: input.brand.trim() || null,
      default_quantity:
        defaultQuantity != null && !Number.isNaN(defaultQuantity)
          ? defaultQuantity
          : null,
      default_unit: input.unit.trim() || null,
      default_category: input.category.trim() || "Other",
      notes: input.notes.trim() || null,
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "barcode,created_by" },
  )

  if (error) logSupabaseError("product_catalog upsert", error)
  return { error: error ?? null }
}

export function applyFieldsToScanForm(
  fields: ScannedProductFields,
  setters: {
    setProductName: (v: string) => void
    setBrand: (v: string) => void
    setQuantity: (v: string) => void
    setUnit: (v: string) => void
    setCategory: (v: string) => void
    setNotes: (v: string) => void
  },
): void {
  setters.setProductName(fields.productName)
  setters.setBrand(fields.brand)
  setters.setQuantity(fields.quantity)
  setters.setUnit(fields.unit)
  setters.setCategory(fields.category)
  setters.setNotes(fields.notes)
}

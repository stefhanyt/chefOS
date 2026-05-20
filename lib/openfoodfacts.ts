import type { OpenFoodFactsProduct } from "./types"

export async function lookupBarcode(
  barcode: string
): Promise<OpenFoodFactsProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1) return null
    return data.product as OpenFoodFactsProduct
  } catch {
    return null
  }
}

export function parseProductName(product: OpenFoodFactsProduct): string {
  return (
    product.product_name ||
    product.brands ||
    ""
  )
}

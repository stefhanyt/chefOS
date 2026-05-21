import type { MealStatus, PantryStatus } from "@/lib/types"

export function computePantryStatus(
  quantity: number,
  minimumQuantity: number,
): PantryStatus {
  if (quantity === 0) return "Out of Stock"
  if (quantity < minimumQuantity) return "Critical"
  if (quantity <= minimumQuantity * 1.25) return "Low"
  return "OK"
}

export function computeMealStatus(expiryDate: string): MealStatus {
  const today = new Date()
  const expiry = new Date(expiryDate)
  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (daysUntilExpiry < 0) return "Expired"
  if (daysUntilExpiry <= 2) return "Use Soon"
  return "Fresh"
}

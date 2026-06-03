import type { ResidenceAccess } from "@/lib/home-access"

/** Private notes: Owner/Admin and Manager/Chef only. */
export function canViewPrivateNotes(
  access: ResidenceAccess | undefined,
): boolean {
  if (!access) return false
  return access.isOwner || access.canEditMenu
}

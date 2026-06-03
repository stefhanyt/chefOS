import type { Home, HomeMember, MemberRole } from "@/lib/types"

export type EffectiveRole = "owner" | MemberRole

/** Roles assignable when inviting (owner is implicit via homes.owner_id). */
export const INVITE_MEMBER_ROLES: MemberRole[] = ["manager", "staff", "viewer"]

export const ALL_MEMBER_ROLES: MemberRole[] = [
  "admin",
  "manager",
  "staff",
  "viewer",
]

export const ROLE_LABELS: Record<EffectiveRole, string> = {
  owner: "Owner / Admin",
  admin: "Admin",
  manager: "Manager / Chef",
  staff: "Staff / Assistant",
  viewer: "Viewer",
}

export interface MemberPermissionFlags {
  can_edit_pantry: boolean
  can_add_shopping_items: boolean
  can_log_meals: boolean
  can_manage_team: boolean
  can_edit_menu: boolean
  can_manage_menu: boolean
  can_archive_residence: boolean
  can_use_scan: boolean
  can_manage_dish_repertoire: boolean
}

/** DB flags synced from role on invite / role change (matches migration backfill). */
export function flagsForRole(role: MemberRole): MemberPermissionFlags {
  switch (role) {
    case "admin":
      return {
        can_edit_pantry: true,
        can_add_shopping_items: true,
        can_log_meals: true,
        can_manage_team: true,
        can_edit_menu: true,
        can_manage_menu: true,
        can_archive_residence: true,
        can_use_scan: true,
        can_manage_dish_repertoire: true,
      }
    case "manager":
      return {
        can_edit_pantry: true,
        can_add_shopping_items: true,
        can_log_meals: true,
        can_manage_team: false,
        can_edit_menu: true,
        can_manage_menu: true,
        can_archive_residence: false,
        can_use_scan: true,
        can_manage_dish_repertoire: true,
      }
    case "staff":
      return {
        can_edit_pantry: false,
        can_add_shopping_items: true,
        can_log_meals: false,
        can_manage_team: false,
        can_edit_menu: false,
        can_manage_menu: false,
        can_archive_residence: false,
        can_use_scan: false,
        can_manage_dish_repertoire: false,
      }
    case "viewer":
      return {
        can_edit_pantry: false,
        can_add_shopping_items: false,
        can_log_meals: false,
        can_manage_team: false,
        can_edit_menu: false,
        can_manage_menu: false,
        can_archive_residence: false,
        can_use_scan: false,
        can_manage_dish_repertoire: false,
      }
  }
}

export interface ResidenceAccess {
  homeId: string
  isOwner: boolean
  role: EffectiveRole
  canManageTeam: boolean
  canArchiveResidence: boolean
  canEditPantry: boolean
  canEditShopping: boolean
  canLogMeals: boolean
  canEditMenu: boolean
  canUseScan: boolean
  canManageDishRepertoire: boolean
  canViewPantry: boolean
  canViewShopping: boolean
  canViewMenu: boolean
  canViewMeals: boolean
  canAddHome: boolean
  canEditHomeDetails: boolean
}

export function resolveResidenceAccess(
  userId: string,
  home: Pick<Home, "id" | "owner_id">,
  member:
    | Pick<
        HomeMember,
        | "role"
        | "can_edit_pantry"
        | "can_add_shopping_items"
        | "can_log_meals"
      >
    | null
    | undefined,
): ResidenceAccess {
  const isOwner = home.owner_id === userId
  if (isOwner) {
    return {
      homeId: home.id,
      isOwner: true,
      role: "owner",
      canManageTeam: true,
      canArchiveResidence: true,
      canEditPantry: true,
      canEditShopping: true,
      canLogMeals: true,
      canEditMenu: true,
      canUseScan: true,
      canManageDishRepertoire: true,
      canViewPantry: true,
      canViewShopping: true,
      canViewMenu: true,
      canViewMeals: true,
      canAddHome: true,
      canEditHomeDetails: true,
    }
  }

  const role: MemberRole = member?.role ?? "viewer"
  const flags = member
    ? {
        can_edit_pantry: member.can_edit_pantry,
        can_add_shopping_items: member.can_add_shopping_items,
        can_log_meals: member.can_log_meals,
      }
    : flagsForRole(role)

  const isAdmin = role === "admin"
  const isManager = role === "manager"
  const isViewer = role === "viewer"

  return {
    homeId: home.id,
    isOwner: false,
    role,
    canManageTeam: isAdmin,
    canArchiveResidence: isAdmin,
    canEditPantry: flags.can_edit_pantry,
    canEditShopping: flags.can_add_shopping_items,
    canLogMeals: flags.can_log_meals,
    canEditMenu: isAdmin || isManager,
    canUseScan: isAdmin || isManager,
    canManageDishRepertoire: isAdmin || isManager,
    canViewPantry: !isViewer,
    canViewShopping: !isViewer,
    canViewMenu: true,
    canViewMeals: true,
    canAddHome: false,
    canEditHomeDetails: isAdmin,
  }
}

export interface MergedHomeAccess {
  canManageTeam: boolean
  canArchiveResidence: boolean
  canEditPantry: boolean
  canEditShopping: boolean
  canLogMeals: boolean
  canEditMenu: boolean
  canUseScan: boolean
  canManageDishRepertoire: boolean
  canViewPantry: boolean
  canViewShopping: boolean
  canViewMenu: boolean
  canViewMeals: boolean
  canAddHome: boolean
  canEditHomeDetails: boolean
  isViewerOnly: boolean
}

export function mergeResidenceAccess(
  list: ResidenceAccess[],
): MergedHomeAccess {
  const any = (fn: (a: ResidenceAccess) => boolean) => list.some(fn)
  return {
    canManageTeam: any((a) => a.canManageTeam),
    canArchiveResidence: any((a) => a.canArchiveResidence),
    canEditPantry: any((a) => a.canEditPantry),
    canEditShopping: any((a) => a.canEditShopping),
    canLogMeals: any((a) => a.canLogMeals),
    canEditMenu: any((a) => a.canEditMenu),
    canUseScan: any((a) => a.canUseScan),
    canManageDishRepertoire: any((a) => a.canManageDishRepertoire),
    canViewPantry: any((a) => a.canViewPantry),
    canViewShopping: any((a) => a.canViewShopping),
    canViewMenu: any((a) => a.canViewMenu),
    canViewMeals: any((a) => a.canViewMeals),
    canAddHome: any((a) => a.canAddHome),
    canEditHomeDetails: any((a) => a.canEditHomeDetails),
    isViewerOnly:
      list.length > 0 && list.every((a) => a.role === "viewer"),
  }
}

export function buildAccessMap(
  userId: string,
  homes: Pick<Home, "id" | "owner_id">[],
  members: HomeMember[],
): Map<string, ResidenceAccess> {
  const byHome = new Map<string, ResidenceAccess>()
  for (const home of homes) {
    const member = members.find(
      (m) => m.home_id === home.id && m.user_id === userId,
    )
    byHome.set(
      home.id,
      resolveResidenceAccess(userId, home, member ?? null),
    )
  }
  return byHome
}

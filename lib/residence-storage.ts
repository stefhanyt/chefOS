export const ACTIVE_HOME_STORAGE_KEY = "chefos-active-home-id"
export const ONBOARDING_DISMISS_KEY = "chefos-onboarding-dismissed"

export function readActiveHomeId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_HOME_STORAGE_KEY)
}

export function writeActiveHomeId(id: string | null): void {
  if (typeof window === "undefined") return
  if (!id) localStorage.removeItem(ACTIVE_HOME_STORAGE_KEY)
  else localStorage.setItem(ACTIVE_HOME_STORAGE_KEY, id)
}

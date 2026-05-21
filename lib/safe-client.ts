/** Browser-only helpers with guards for mobile Safari / private mode / older WebViews */

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

/** Stable id for toasts etc. — crypto.randomUUID is missing on some mobile WebViews */
export function generateClientId(): string {
  if (isBrowser()) {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
      }
    } catch {
      /* fall through */
    }
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function getWindowOrigin(): string {
  if (!isBrowser()) return ""
  return window.location.origin
}

/** localStorage wrapper — never throws (private browsing / ITP blocks storage) */
export function safeLocalStorage(): Storage | null {
  if (!isBrowser()) return null
  try {
    const key = "__chefos_ls_test__"
    window.localStorage.setItem(key, "1")
    window.localStorage.removeItem(key)
    return window.localStorage
  } catch {
    return null
  }
}

export function safeSessionStorage(): Storage | null {
  if (!isBrowser()) return null
  try {
    const key = "__chefos_ss_test__"
    window.sessionStorage.setItem(key, "1")
    window.sessionStorage.removeItem(key)
    return window.sessionStorage
  } catch {
    return null
  }
}

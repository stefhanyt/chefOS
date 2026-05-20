const DEFAULT_REDIRECT = "/dashboard"

/** Internal path only — rejects external and protocol-relative URLs. */
export function getSafeRedirectPath(
  path: string | null | undefined,
  fallback = DEFAULT_REDIRECT,
): string {
  if (!path) return fallback

  const trimmed = path.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback
  if (trimmed.includes("://") || trimmed.includes("\\")) return fallback
  if (trimmed.startsWith("/login")) return fallback

  return trimmed
}

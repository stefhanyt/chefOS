/** Pick the most frequent non-empty string value */
export function pickMode(counts: Map<string, number>): string {
  let best = ""
  let max = 0
  counts.forEach((count, value) => {
    if (!value.trim()) return
    if (count > max) {
      max = count
      best = value
    }
  })
  return best
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export function matchesPrefix(query: string, name: string): boolean {
  const q = normalizeName(query)
  if (!q) return true
  return normalizeName(name).includes(q)
}

export function scoreSuggestion(query: string, name: string, count: number): number {
  const q = normalizeName(query)
  const n = normalizeName(name)
  if (!q) return count
  if (n === q) return 10000 + count
  if (n.startsWith(q)) return 5000 + count
  if (n.includes(q)) return 1000 + count
  return count
}

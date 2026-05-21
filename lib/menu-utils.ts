export const MENU_CATEGORIES = [
  "Mains",
  "Sides",
  "Soups",
  "Desserts",
  "Sauces & Condiments",
] as const

export const MENU_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

export const MENU_SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function getWeekDates(offset: number): Date[] {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7)
  return MENU_DAYS.map((_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export function getWeekStart(offset: number): string {
  const dates = getWeekDates(offset)
  return dates[0].toISOString().split("T")[0]
}

export function formatMenuDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
}

export function weekLabel(offset: number): string {
  if (offset === 0) return "This Week"
  if (offset === 1) return "Next Week"
  if (offset === -1) return "Last Week"
  return `Week ${offset > 0 ? "+" : ""}${offset}`
}

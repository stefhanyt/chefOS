import type { StatusType, PantryStatus, MealStatus, Priority } from "@/lib/types"

interface Props {
  label: string
  type?: StatusType
}

const styles: Record<StatusType, string> = {
  critical: "bg-rose-50 text-rose-800 ring-1 ring-rose-100/80",
  low: "bg-amber-50/90 text-amber-900 ring-1 ring-amber-100/80",
  ok: "bg-stone-100 text-stone-600 ring-1 ring-stone-200/60",
  blue: "bg-navy/5 text-navy-light ring-1 ring-navy/10",
  warning: "bg-orange-50/90 text-orange-900 ring-1 ring-orange-100/80",
}

export function pantryStatusType(status: PantryStatus): StatusType {
  if (status === "Out of Stock" || status === "Critical") return "critical"
  if (status === "Low") return "low"
  return "ok"
}

export function mealStatusType(status: MealStatus): StatusType {
  if (status === "Expired") return "critical"
  if (status === "Use Soon") return "low"
  return "ok"
}

export function priorityType(priority: Priority): StatusType {
  if (priority === "Urgent") return "critical"
  if (priority === "Important") return "warning"
  return "blue"
}

export default function StatusBadge({ label, type = "blue" }: Props) {
  return (
    <span
      className={`
        inline-flex items-center
        rounded-full px-2.5 py-0.5
        text-[11px] font-semibold tracking-wide
        whitespace-nowrap
        ${styles[type]}
      `}
    >
      {label}
    </span>
  )
}

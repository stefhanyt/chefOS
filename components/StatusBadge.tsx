import type { StatusType, PantryStatus, MealStatus, Priority } from "@/lib/types"

interface Props {
  label: string
  type?: StatusType
}

const styles: Record<StatusType, string> = {
  critical: "bg-red-100 text-red-800",
  low: "bg-amber-100 text-amber-700",
  ok: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  warning: "bg-orange-100 text-orange-700",
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
        rounded-full px-3 py-1
        text-xs font-extrabold
        whitespace-nowrap
        ${styles[type]}
      `}
    >
      {label}
    </span>
  )
}

import type { PreparedMeal } from "@/lib/types"
import StatusBadge, { mealStatusType } from "./StatusBadge"
import { Home, Layers, Flame } from "lucide-react"

interface Props {
  meal: PreparedMeal
}

export default function MealCard({ meal }: Props) {
  const expiry = new Date(meal.expiry_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  const expiryLabel =
    diffDays < 0
      ? `Expired ${Math.abs(diffDays)}d ago`
      : diffDays === 0
      ? "Expires today"
      : `Expires in ${diffDays}d`

  return (
    <div
      className="
        mb-3 rounded-[22px] border border-[#E6EEF8]
        bg-white p-4 shadow-md shadow-slate-900/4
      "
    >
      <div className="flex items-start justify-between">
        <h3 className="font-extrabold text-slate-900">{meal.name}</h3>
        <StatusBadge
          label={meal.status}
          type={mealStatusType(meal.status)}
        />
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
        <span className="flex items-center gap-1">
          <Home size={11} />
          {meal.home?.name ?? "—"}
        </span>
        <span className="flex items-center gap-1">
          <Layers size={11} />
          {meal.portions} portions
        </span>
        <span className="flex items-center gap-1">
          <Flame size={11} />
          {meal.storage_location}
        </span>
      </div>

      <div
        className={`
          mt-3 text-xs font-semibold
          ${meal.status === "Expired"
            ? "text-red-600"
            : meal.status === "Use Soon"
            ? "text-amber-600"
            : "text-green-600"
          }
        `}
      >
        {expiryLabel}
      </div>

      {meal.reheating_instructions && (
        <p className="mt-2 text-xs text-slate-400 italic">
          ↻ {meal.reheating_instructions}
        </p>
      )}
    </div>
  )
}

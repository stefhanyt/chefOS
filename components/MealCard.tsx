import type { PreparedMeal } from "@/lib/types"
import StatusBadge, { mealStatusType } from "./StatusBadge"
import { Home, Layers, Flame, Pencil, Trash2 } from "lucide-react"

interface Props {
  meal: PreparedMeal
  onEdit?: (meal: PreparedMeal) => void
  onRemove?: (meal: PreparedMeal) => void
}

export default function MealCard({ meal, onEdit, onRemove }: Props) {
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
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(meal)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
              aria-label="Edit meal"
            >
              <Pencil size={15} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(meal)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-red-400 active:bg-red-50"
              aria-label="Remove meal"
            >
              <Trash2 size={15} />
            </button>
          )}
          <StatusBadge
            label={meal.status}
            type={mealStatusType(meal.status)}
          />
        </div>
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

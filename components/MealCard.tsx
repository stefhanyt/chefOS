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
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  const expiryLabel =
    diffDays < 0
      ? `Expired ${Math.abs(diffDays)}d ago`
      : diffDays === 0
        ? "Expires today"
        : `Expires in ${diffDays}d`

  const expiryTone =
    meal.status === "Expired"
      ? "text-rose-700"
      : meal.status === "Use Soon"
        ? "text-amber-800"
        : "text-stone-600"

  return (
    <div className="chef-card-elevated mb-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-charcoal">{meal.name}</h3>
        <div className="flex shrink-0 items-center gap-0.5">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(meal)}
              className="mobile-header-button flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100"
              aria-label="Edit meal"
            >
              <Pencil size={15} strokeWidth={1.5} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(meal)}
              className="mobile-header-button flex items-center justify-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-700"
              aria-label="Remove meal"
            >
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          )}
          <StatusBadge label={meal.status} type={mealStatusType(meal.status)} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
        <span className="flex items-center gap-1">
          <Home size={11} strokeWidth={1.5} />
          {meal.home?.name ?? "—"}
        </span>
        <span className="flex items-center gap-1">
          <Layers size={11} strokeWidth={1.5} />
          {meal.portions} portions
        </span>
        <span className="flex items-center gap-1">
          <Flame size={11} strokeWidth={1.5} />
          {meal.storage_location}
        </span>
      </div>

      <p className={`mt-2.5 text-xs font-medium ${expiryTone}`}>{expiryLabel}</p>

      {meal.reheating_instructions && (
        <p className="mt-2 text-xs italic text-stone-500">
          {meal.reheating_instructions}
        </p>
      )}
    </div>
  )
}

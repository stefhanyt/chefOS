"use client"

import type { PantryItem } from "@/lib/types"
import StatusBadge, { pantryStatusType } from "./StatusBadge"
import { MapPin, Minus, Plus, Pencil, Trash2 } from "lucide-react"

interface Props {
  item: PantryItem
  onQuantityChange?: (id: string, delta: number) => void
  onEdit?: (item: PantryItem) => void
  onRemove?: (item: PantryItem) => void
}

export default function PantryItemCard({
  item,
  onQuantityChange,
  onEdit,
  onRemove,
}: Props) {
  return (
    <div className="chef-card-elevated mb-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-charcoal">
            {item.name}
          </h3>
          {item.preferred_brand && (
            <p className="mt-0.5 text-xs text-stone-500">{item.preferred_brand}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="mobile-header-button flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-charcoal"
              aria-label="Edit item"
            >
              <Pencil size={15} strokeWidth={1.5} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="mobile-header-button flex items-center justify-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-700"
              aria-label="Remove item"
            >
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          )}
          <StatusBadge
            label={item.status}
            type={pantryStatusType(item.status)}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-stone-500">
          <span className="flex items-center gap-1">
            <MapPin size={12} strokeWidth={1.5} />
            {item.storage_location}
          </span>
          <span className="rounded-lg bg-stone-100/80 px-2 py-0.5 text-xs font-medium text-stone-600">
            {item.category}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onQuantityChange?.(item.id, -1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200/80 bg-stone-50 text-stone-600 active:bg-stone-100"
          >
            <Minus size={14} strokeWidth={2} />
          </button>
          <span className="min-w-[3.25rem] text-center text-sm font-semibold tabular-nums text-charcoal">
            {item.quantity} {item.unit}
          </span>
          <button
            type="button"
            onClick={() => onQuantityChange?.(item.id, 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-navy/10 bg-navy/5 text-navy active:bg-navy/10"
          >
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {item.quantity < item.minimum_quantity && (
        <p className="mt-2 text-xs text-stone-500">
          Minimum {item.minimum_quantity} {item.unit}
        </p>
      )}
    </div>
  )
}

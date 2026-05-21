"use client"

import type { ShoppingItem } from "@/lib/types"
import StatusBadge, { priorityType } from "./StatusBadge"
import { Check, Home, Trash2 } from "lucide-react"

interface Props {
  item: ShoppingItem
  onPurchase?: (id: string) => void
  onRemove?: (item: ShoppingItem) => void
}

export default function ShoppingItemCard({ item, onPurchase, onRemove }: Props) {
  const isPurchased = item.status === "Purchased"

  return (
    <div
      className={`flex items-center justify-between gap-2 border-b border-stone-100 py-4 last:border-0 ${
        isPurchased ? "opacity-55" : ""
      }`}
    >
      <div className="min-w-0 flex-1 pr-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={`font-semibold text-charcoal ${
              isPurchased ? "line-through decoration-stone-300" : ""
            }`}
          >
            {item.name}
          </h3>
          {item.priority !== "Normal" && (
            <StatusBadge
              label={item.priority}
              type={priorityType(item.priority)}
            />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <Home size={10} strokeWidth={1.5} />
            {item.home?.name ?? "—"}
          </span>
          <span>{item.quantity_needed}</span>
          <span>· {item.added_by_profile?.display_name ?? "Staff"}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        {!isPurchased && onRemove && (
          <button
            type="button"
            onClick={() => onRemove(item)}
            className="flex h-10 w-10 items-center justify-center text-stone-400 hover:text-rose-700"
            aria-label="Remove item"
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        )}
        <button
          type="button"
          onClick={() => !isPurchased && onPurchase?.(item.id)}
          className="flex h-10 w-10 items-center justify-center"
          aria-label={isPurchased ? "Purchased" : "Mark as purchased"}
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all ${
              isPurchased
                ? "border-navy bg-navy"
                : "border-stone-300 hover:border-gold/60"
            }`}
          >
            {isPurchased && (
              <Check size={14} className="text-ivory" strokeWidth={2.5} />
            )}
          </span>
        </button>
      </div>
    </div>
  )
}

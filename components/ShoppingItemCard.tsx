"use client"

import type { ShoppingItem } from "@/lib/types"
import StatusBadge, { priorityType } from "./StatusBadge"
import { Check, Home } from "lucide-react"

interface Props {
  item: ShoppingItem
  onPurchase?: (id: string) => void
}

export default function ShoppingItemCard({ item, onPurchase }: Props) {
  const isPurchased = item.status === "Purchased"

  return (
    <div
      className={`
        flex items-center justify-between py-4
        border-b border-slate-100 last:border-0
        ${isPurchased ? "opacity-50" : ""}
      `}
    >
      <div className="flex-1 min-w-0 pr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className={`
              font-bold text-slate-900
              ${isPurchased ? "line-through" : ""}
            `}
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
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Home size={10} />
            {item.home?.name ?? "—"}
          </span>
          <span>·</span>
          <span>
            {item.quantity_needed}
          </span>
          <span>·</span>
          <span>by {item.added_by_profile?.display_name ?? "Someone"}</span>
        </div>
      </div>

      {/* 44px hit area, 28px visual checkbox */}
      <button
        onClick={() => !isPurchased && onPurchase?.(item.id)}
        className="flex h-11 w-11 shrink-0 items-center justify-center"
        aria-label={isPurchased ? "Purchased" : "Mark as purchased"}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all ${
            isPurchased
              ? "border-green-500 bg-green-500"
              : "border-slate-300 active:border-blue-400"
          }`}
        >
          {isPurchased && (
            <Check size={14} className="text-white" strokeWidth={3} />
          )}
        </span>
      </button>
    </div>
  )
}

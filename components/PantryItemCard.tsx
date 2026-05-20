"use client"

import type { PantryItem } from "@/lib/types"
import StatusBadge, { pantryStatusType } from "./StatusBadge"
import { MapPin, Minus, Plus } from "lucide-react"

interface Props {
  item: PantryItem
  onQuantityChange?: (id: string, delta: number) => void
}

export default function PantryItemCard({ item, onQuantityChange }: Props) {
  return (
    <div
      className="
        mb-3 rounded-[22px] border border-[#E6EEF8]
        bg-white p-4 shadow-md shadow-slate-900/4
      "
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-extrabold text-slate-900 truncate">
            {item.name}
          </h3>
          {item.preferred_brand && (
            <p className="text-xs text-slate-400 mt-0.5">{item.preferred_brand}</p>
          )}
        </div>
        <StatusBadge
          label={item.status}
          type={pantryStatusType(item.status)}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500 flex items-center gap-1">
            <MapPin size={12} />
            {item.storage_location}
          </div>
          <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-2 py-1">
            {item.category}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onQuantityChange?.(item.id, -1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:bg-slate-200"
          >
            <Minus size={14} />
          </button>
          <span className="min-w-[3.5rem] text-center text-sm font-extrabold text-slate-900">
            {item.quantity} {item.unit}
          </span>
          <button
            onClick={() => onQuantityChange?.(item.id, 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700 active:bg-blue-200"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {item.quantity < item.minimum_quantity && (
        <div className="mt-2 text-xs text-slate-400">
          Min: {item.minimum_quantity} {item.unit}
        </div>
      )}
    </div>
  )
}

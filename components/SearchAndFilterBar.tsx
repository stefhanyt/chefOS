"use client"

import { Search, SlidersHorizontal } from "lucide-react"

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onFilter?: () => void
}

export default function SearchAndFilterBar({
  value,
  onChange,
  placeholder = "Search…",
  onFilter,
}: Props) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <div className="relative flex-1">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
          strokeWidth={1.5}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="chef-input min-h-[44px] pl-10 shadow-card"
        />
      </div>
      {onFilter && (
        <button
          type="button"
          onClick={onFilter}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-200/80 bg-surface text-stone-500 shadow-card active:bg-stone-50"
        >
          <SlidersHorizontal size={17} strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}

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
    <div className="flex items-center gap-2 mb-5">
      <div className="relative flex-1">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="
            w-full rounded-2xl border border-[#E6EEF8]
            bg-white py-3 pl-10 pr-4
            min-h-[44px]
            text-base text-slate-900 placeholder:text-slate-400
            shadow-sm shadow-slate-900/4
            focus:outline-none focus:ring-2 focus:ring-blue-200
          "
        />
      </div>
      {onFilter && (
        <button
          onClick={onFilter}
          className="
            flex h-12 w-12 shrink-0 items-center justify-center
            rounded-2xl border border-[#E6EEF8]
            bg-white shadow-sm shadow-slate-900/4
            text-slate-500 active:bg-slate-50
          "
        >
          <SlidersHorizontal size={17} />
        </button>
      )}
    </div>
  )
}

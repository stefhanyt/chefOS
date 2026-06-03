"use client"

import Link from "next/link"
import { MapPin, ChevronDown } from "lucide-react"
import { useResidence } from "@/contexts/ResidenceContext"
import { ui } from "@/lib/ui"

export default function CurrentResidenceBar({
  showAllOption = true,
}: {
  showAllOption?: boolean
}) {
  const { homes, activeHomeId, activeHome, loading, setActiveHomeId } =
    useResidence()

  if (loading) {
    return (
      <div className={`${ui.cardInset} mb-4 h-12 animate-pulse rounded-2xl`} />
    )
  }

  if (homes.length === 0) {
    return (
      <div className="mb-4 rounded-2xl border border-dashed border-stone-200/80 bg-stone-50/60 px-4 py-3 text-sm text-stone-500">
        No active residence.{" "}
        <Link href="/homes" className="font-semibold text-navy-light">
          Create one
        </Link>
      </div>
    )
  }

  if (homes.length === 1 && activeHome) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-stone-200/60 bg-white px-4 py-3 shadow-sm">
        <MapPin size={14} className="shrink-0 text-navy-light" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Current residence
          </p>
          <p className="truncate text-sm font-semibold text-charcoal">
            {activeHome.name}
            <span className="font-normal text-stone-500"> · {activeHome.location}</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-2xl border border-stone-200/60 bg-white px-4 py-3 shadow-sm">
      <label className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
        <MapPin size={11} strokeWidth={1.5} />
        Current residence
      </label>
      <div className="relative">
        <select
          value={activeHomeId ?? ""}
          onChange={(e) =>
            setActiveHomeId(e.target.value ? e.target.value : null)
          }
          className="w-full min-h-[44px] appearance-none rounded-xl border border-stone-200/60 bg-slate-50 py-2.5 pl-3 pr-9 text-sm font-semibold text-charcoal focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          {showAllOption && <option value="">All residences</option>}
          {homes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} · {h.location}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
        />
      </div>
    </div>
  )
}

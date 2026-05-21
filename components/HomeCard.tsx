import Link from "next/link"
import type { Home } from "@/lib/types"
import StatusBadge from "./StatusBadge"
import { MapPin, Users, ShoppingCart, AlertTriangle, UtensilsCrossed, Pencil } from "lucide-react"

interface Props {
  home: Home
  onEdit?: (home: Home) => void
}

export default function HomeCard({ home, onEdit }: Props) {
  const hasAlerts =
    (home.pantry_alert_count ?? 0) > 0 || (home.expiring_meal_count ?? 0) > 0

  return (
    <div className="relative mb-4">
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(home)}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm"
          aria-label="Edit residence"
        >
          <Pencil size={15} />
        </button>
      )}
      <Link href={`/homes/${home.id}`}>
        <div
          className="
            rounded-[26px] border border-[#E6EEF8]
            bg-white p-5 shadow-lg shadow-slate-900/5
            active:scale-[0.98] transition-transform
          "
        >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              {home.name}
            </h3>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={11} />
              {home.location}
            </div>
          </div>
          <StatusBadge
            label={hasAlerts ? "Needs Attention" : "All Good"}
            type={hasAlerts ? "low" : "ok"}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat
            icon={<AlertTriangle size={13} />}
            label="Alerts"
            value={home.pantry_alert_count ?? 0}
            warn={(home.pantry_alert_count ?? 0) > 0}
          />
          <Stat
            icon={<ShoppingCart size={13} />}
            label="Shopping"
            value={home.open_shopping_count ?? 0}
          />
          <Stat
            icon={<Users size={13} />}
            label="Staff"
            value={home.member_count ?? 0}
          />
        </div>

        {(home.expiring_meal_count ?? 0) > 0 && (
          <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            <UtensilsCrossed size={12} />
            {home.expiring_meal_count} meal{home.expiring_meal_count !== 1 ? "s" : ""} expiring soon
          </div>
        )}
        </div>
      </Link>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  warn,
}: {
  icon: React.ReactNode
  label: string
  value: number
  warn?: boolean
}) {
  return (
    <div
      className={`
        rounded-xl px-3 py-2 text-center
        ${warn ? "bg-red-50" : "bg-slate-50"}
      `}
    >
      <div
        className={`
          flex items-center justify-center gap-1
          text-xs font-semibold
          ${warn ? "text-red-600" : "text-slate-400"}
        `}
      >
        {icon}
        {label}
      </div>
      <div
        className={`
          mt-0.5 text-lg font-extrabold
          ${warn ? "text-red-700" : "text-slate-700"}
        `}
      >
        {value}
      </div>
    </div>
  )
}

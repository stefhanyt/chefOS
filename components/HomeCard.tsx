import Link from "next/link"
import type { Home } from "@/lib/types"
import StatusBadge from "./StatusBadge"
import {
  MapPin,
  Users,
  ShoppingCart,
  AlertTriangle,
  UtensilsCrossed,
  Pencil,
} from "lucide-react"

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
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-stone-200/60 bg-surface/95 text-stone-500 shadow-card backdrop-blur-sm"
          aria-label="Edit residence"
        >
          <Pencil size={14} strokeWidth={1.5} />
        </button>
      )}
      <Link href={`/homes/${home.id}`}>
        <div className="chef-card-elevated p-5 transition active:scale-[0.99]">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <h3 className="font-display text-lg font-semibold text-charcoal">
                {home.name}
              </h3>
              <div className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                <MapPin size={11} strokeWidth={1.5} />
                {home.location}
              </div>
            </div>
            <StatusBadge
              label={hasAlerts ? "Attention" : "In order"}
              type={hasAlerts ? "low" : "ok"}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat
              icon={<AlertTriangle size={13} strokeWidth={1.5} />}
              label="Alerts"
              value={home.pantry_alert_count ?? 0}
              warn={(home.pantry_alert_count ?? 0) > 0}
            />
            <Stat
              icon={<ShoppingCart size={13} strokeWidth={1.5} />}
              label="Shopping"
              value={home.open_shopping_count ?? 0}
            />
            <Stat
              icon={<Users size={13} strokeWidth={1.5} />}
              label="Staff"
              value={home.member_count ?? 0}
            />
          </div>

          {(home.expiring_meal_count ?? 0) > 0 && (
            <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-amber-100/80 bg-amber-50/60 px-3 py-2 text-xs font-medium text-amber-900">
              <UtensilsCrossed size={12} strokeWidth={1.5} />
              {home.expiring_meal_count} meal
              {home.expiring_meal_count !== 1 ? "s" : ""} expiring soon
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
      className={`rounded-xl px-2 py-2.5 text-center ${
        warn ? "bg-rose-50/80" : "bg-stone-100/60"
      }`}
    >
      <div
        className={`flex items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          warn ? "text-rose-700" : "text-stone-500"
        }`}
      >
        {icon}
        {label}
      </div>
      <div
        className={`mt-0.5 font-display text-xl font-semibold ${
          warn ? "text-rose-800" : "text-charcoal"
        }`}
      >
        {value}
      </div>
    </div>
  )
}

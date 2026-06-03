import Link from "next/link"
import { Home } from "lucide-react"
import { ui } from "@/lib/ui"

export default function NoHomesBanner({
  compact = false,
}: {
  compact?: boolean
}) {
  return (
    <div
      className={
        compact
          ? "mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3"
          : `${ui.card} mb-4 border-amber-200/60 bg-amber-50/80 p-4`
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100/80 text-amber-800">
          <Home size={18} strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-charcoal">Add a residence first</p>
          <p className="mt-0.5 text-sm leading-relaxed text-stone-600">
            Pantry, meals, shopping, and menus are tied to a home.
          </p>
          <Link
            href="/homes"
            className={`${ui.link} mt-2 inline-flex min-h-[44px] items-center`}
          >
            Go to Residences →
          </Link>
        </div>
      </div>
    </div>
  )
}

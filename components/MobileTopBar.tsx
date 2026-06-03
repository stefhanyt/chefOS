import Link from "next/link"
import { ChevronLeft } from "lucide-react"

type Props = {
  backHref?: string
  onBack?: () => void
  backLabel?: string
  /** Omit for back-only rows (e.g. detail pages with a hero title below). */
  title?: string
  trailing?: React.ReactNode
  className?: string
}

/**
 * iOS-safe top bar: back control, centered title, optional trailing action.
 * Use as the first child inside AppShell for scan and sub-pages.
 */
export default function MobileTopBar({
  backHref,
  onBack,
  backLabel = "Back",
  title,
  trailing,
  className = "",
}: Props) {
  const backClassName =
    "mobile-header-button -ml-1 inline-flex shrink-0 items-center justify-center gap-0.5 rounded-xl px-1 text-sm font-bold text-navy-light"

  return (
    <header
      className={`mobile-safe-header mobile-top-bar ${className}`.trim()}
      role="banner"
    >
      {onBack ? (
        <button type="button" onClick={onBack} className={backClassName}>
          <ChevronLeft size={18} strokeWidth={2.5} aria-hidden />
          <span>{backLabel}</span>
        </button>
      ) : (
        <Link href={backHref ?? "/dashboard"} className={backClassName}>
          <ChevronLeft size={18} strokeWidth={2.5} aria-hidden />
          <span>{backLabel}</span>
        </Link>
      )}

      {title ? (
        <h1 className="mobile-top-bar__title min-w-0 flex-1 truncate px-1 text-center font-display text-lg font-semibold tracking-tight text-charcoal">
          {title}
        </h1>
      ) : (
        <div className="min-w-0 flex-1" aria-hidden />
      )}

      <div className="flex w-11 shrink-0 items-center justify-end">
        {trailing ?? <span className="w-11" aria-hidden />}
      </div>
    </header>
  )
}

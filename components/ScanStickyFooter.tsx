"use client"

/**
 * Fixed action bar above the bottom nav, with home-indicator safe area.
 */
export default function ScanStickyFooter({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="scan-sticky-footer" role="group" aria-label="Scan actions">
      <div className="scan-sticky-footer__inner">{children}</div>
    </div>
  )
}

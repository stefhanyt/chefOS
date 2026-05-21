"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

/** Set true to debug modal layer stacking with red outlines. */
export const DEBUG_MODAL_LAYERS = false

const debugOutline = DEBUG_MODAL_LAYERS
  ? "outline outline-[3px] outline-red-500 outline-offset-1"
  : ""

interface SheetModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** Sticky footer (e.g. submit button) — stays above bottom nav and receives clicks */
  footer?: React.ReactNode
}

export default function SheetModal({
  open,
  onClose,
  title,
  children,
  footer,
}: SheetModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4 ${debugOutline}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-modal-title"
      data-layer="sheet-modal-root"
    >
      {/* Backdrop — separate layer so sheet/footer stay clickable */}
      <button
        type="button"
        aria-label="Close dialog"
        className={`absolute inset-0 z-0 bg-slate-900/40 backdrop-blur-sm ${debugOutline}`}
        data-layer="sheet-modal-backdrop"
        onClick={onClose}
      />

      <div
        className={`relative z-10 flex max-h-[min(88dvh,100dvh)] w-full max-w-md flex-col rounded-t-[32px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[32px] ${debugOutline}`}
        data-layer="sheet-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 ${debugOutline}`}
          data-layer="sheet-modal-header"
        >
          <h2 id="sheet-modal-title" className="text-xl font-extrabold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 ${debugOutline}`}
          data-layer="sheet-modal-body"
        >
          {children}
        </div>

        {footer ? (
          <div
            className={`shrink-0 border-t border-slate-100 bg-white px-6 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${debugOutline}`}
            data-layer="sheet-modal-footer"
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

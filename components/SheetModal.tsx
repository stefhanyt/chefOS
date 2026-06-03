"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { isBrowser } from "@/lib/safe-client"

export const DEBUG_MODAL_LAYERS = false

const debugOutline = DEBUG_MODAL_LAYERS
  ? "outline outline-[3px] outline-red-500 outline-offset-1"
  : ""

interface SheetModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function SheetModal({
  open,
  onClose,
  title,
  children,
  footer,
}: SheetModalProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (isBrowser() && document.body) {
      setPortalTarget(document.body)
    }
  }, [])

  useEffect(() => {
    if (!open || !isBrowser()) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!portalTarget || !open) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4 ${debugOutline}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-modal-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className={`absolute inset-0 z-0 bg-navy/30 backdrop-blur-[2px] ${debugOutline}`}
        onClick={onClose}
      />

      <div
        className={`relative z-10 flex max-h-[min(88dvh,92vh)] w-full max-w-md flex-col rounded-t-[28px] border border-stone-200/50 bg-surface shadow-card-lg sm:max-h-[min(90dvh,92vh)] sm:rounded-[28px] ${debugOutline}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex shrink-0 items-center justify-between border-b border-stone-100 px-6 py-5 ${debugOutline}`}
        >
          <h2
            id="sheet-modal-title"
            className="font-display text-xl font-semibold tracking-tight text-charcoal"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200/80 bg-stone-50/80 text-stone-500 transition hover:bg-stone-100"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 ${debugOutline}`}
        >
          {children}
        </div>

        {footer ? (
          <div
            className={`shrink-0 border-t border-stone-100 bg-surface/95 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm ${debugOutline}`}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    portalTarget,
  )
}

"use client"

import SheetModal from "@/components/SheetModal"
import { ui } from "@/lib/ui"

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  if (!open) return null

  return (
    <SheetModal
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={`${ui.btnSecondary} flex-1`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className={`flex min-h-[48px] flex-1 items-center justify-center rounded-xl py-3 text-sm font-semibold disabled:opacity-50 ${
              destructive
                ? "border border-rose-200/80 bg-rose-50 text-rose-800"
                : "bg-navy text-ivory"
            }`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-sm leading-relaxed text-stone-600">{message}</div>
    </SheetModal>
  )
}

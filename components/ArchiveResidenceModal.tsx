"use client"

import SheetModal from "@/components/SheetModal"
import { ui } from "@/lib/ui"

export default function ArchiveResidenceModal({
  open,
  residenceName,
  archiving,
  onClose,
  onConfirm,
}: {
  open: boolean
  residenceName: string
  archiving?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  if (!open) return null

  return (
    <SheetModal
      open
      onClose={onClose}
      title="Archive residence?"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={archiving}
            className={`${ui.btnSecondary} flex-1`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={archiving}
            className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50 py-3 text-sm font-semibold text-rose-800 disabled:opacity-50"
          >
            {archiving ? "Archiving…" : "Archive Residence"}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-stone-600">
        <span className="font-semibold text-charcoal">{residenceName}</span> will
        leave your active list. Pantry, meals, shopping, and history stay in the
        database — you can restore access later if needed.
      </p>
    </SheetModal>
  )
}

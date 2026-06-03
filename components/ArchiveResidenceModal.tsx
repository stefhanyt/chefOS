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
      title="Archive this residence?"
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
        This will remove{" "}
        <span className="font-semibold text-charcoal">{residenceName}</span> from
        your active list, but its pantry, meals, shopping items, and history will be
        kept.
      </p>
    </SheetModal>
  )
}

"use client"

export default function ModalSubmitFooter({
  formId,
  label,
  saving = false,
  disabled,
  missing = [],
}: {
  formId: string
  label: string
  saving?: boolean
  disabled: boolean
  missing?: string[]
}) {
  const canSubmit = !disabled && !saving

  return (
    <div className="space-y-2">
      {!canSubmit && missing.length > 0 && (
        <p className="text-xs text-slate-500">Required: {missing.join(", ")}</p>
      )}
      <button
        type="submit"
        form={formId}
        disabled={!canSubmit}
        aria-disabled={!canSubmit}
        className={`relative z-10 w-full min-h-[48px] rounded-2xl py-4 text-sm font-extrabold text-white shadow-lg touch-manipulation ${
          canSubmit
            ? "bg-blue-600 shadow-blue-600/30 active:scale-[0.98]"
            : "cursor-not-allowed bg-slate-300 shadow-none"
        }`}
      >
        {saving ? "Saving…" : label}
      </button>
    </div>
  )
}

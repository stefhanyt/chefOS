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
        <p className="text-xs text-stone-500">
          Required: {missing.join(", ")}
        </p>
      )}
      <button
        type="submit"
        form={formId}
        disabled={!canSubmit}
        aria-disabled={!canSubmit}
        className={`chef-btn-primary touch-manipulation ${
          canSubmit ? "" : "cursor-not-allowed"
        }`}
      >
        {saving ? "Saving…" : label}
      </button>
    </div>
  )
}

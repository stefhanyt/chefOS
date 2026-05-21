"use client"

import { isBrowser } from "@/lib/safe-client"

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

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!canSubmit) {
      e.preventDefault()
      return
    }
    // Safari/iOS: submit button in modal footer may not trigger form submit via form= attribute
    if (!isBrowser()) return
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (form) {
      e.preventDefault()
      form.requestSubmit()
    }
  }

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
        onClick={handleClick}
        className={`chef-btn-primary touch-manipulation ${
          canSubmit ? "" : "cursor-not-allowed"
        }`}
      >
        {saving ? "Saving…" : label}
      </button>
    </div>
  )
}

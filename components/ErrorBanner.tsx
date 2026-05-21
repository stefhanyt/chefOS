"use client"

import { AlertCircle, RefreshCw } from "lucide-react"

export default function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3.5 text-sm text-rose-800">
      <AlertCircle size={16} className="shrink-0 opacity-80" strokeWidth={1.5} />
      <span className="flex-1 leading-snug">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1 text-xs font-semibold text-rose-900 underline-offset-2 hover:underline"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      )}
    </div>
  )
}

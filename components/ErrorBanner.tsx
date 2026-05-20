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
    <div className="mb-5 flex items-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle size={15} className="shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1 font-bold underline"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      )}
    </div>
  )
}

"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[ChefOS] Client error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ivory px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm rounded-3xl border border-stone-200/60 bg-surface p-8 text-center shadow-card-lg">
        <h1 className="font-display text-xl font-semibold text-charcoal">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-500">
          The app hit an unexpected error. Try again — if you installed ChefOS to
          your home screen, refresh once to load the latest version.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="chef-btn-primary"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl border border-stone-200/80 py-3 text-sm font-semibold text-navy-light"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

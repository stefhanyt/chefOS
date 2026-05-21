"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F7F5F0] p-6 font-sans text-[#1C1C1A]">
        <div className="mx-auto max-w-sm rounded-3xl border border-[#E8E4DC] bg-[#FFFCF8] p-8 text-center shadow-lg">
          <h1 className="text-xl font-semibold">ChefOS encountered an error</h1>
          <p className="mt-3 text-sm text-[#7A756C]">
            Please refresh the page. If you added ChefOS to your home screen, open
            it in Safari once to get the latest version.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 w-full rounded-xl bg-[#0F2438] py-3 text-sm font-semibold text-[#F7F5F0]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

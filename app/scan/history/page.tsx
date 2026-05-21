"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import { createClient } from "@/lib/supabase/client"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { useToast } from "@/components/ToastProvider"
import { CONFIG_ERROR } from "@/lib/constants"
import type { BarcodeScan, Home } from "@/lib/types"
import { ChevronLeft } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"

export default function ScanHistoryPage() {
  const { showError } = useToast()
  const [scans, setScans] = useState<(BarcodeScan & { home?: Home })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      if (!supabase) {
        setError(CONFIG_ERROR)
        setLoading(false)
        return
      }
      try {
        const { data, error: dbError } = await supabase
          .from("barcode_scans")
          .select("*, home:homes(id, name)")
          .order("created_at", { ascending: false })
          .limit(100)
        if (dbError) throw dbError
        setScans((data as (BarcodeScan & { home?: Home })[]) ?? [])
      } catch (err) {
        logSupabaseError("scan history load", err)
        setError("Failed to load scan history.")
        showError(getSupabaseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount, showError])

  return (
    <AppShell>
      <Link
        href="/scan"
        className="mb-4 flex items-center gap-1.5 text-sm font-bold text-blue-600"
      >
        <ChevronLeft size={16} />
        Back to Scan
      </Link>

      <PageHeader
        title="Scan History"
        subtitle={loading ? "Loading…" : `${scans.length} recent scans`}
      />

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[22px] bg-slate-200" />
          ))}
        </div>
      ) : scans.length === 0 ? (
        <div className="rounded-[22px] border border-[#E6EEF8] bg-white p-8 text-center text-sm text-slate-400">
          No scans yet. Use the scanner to add pantry items.
        </div>
      ) : (
        scans.map((scan) => (
          <div
            key={scan.id}
            className="mb-3 rounded-[22px] border border-[#E6EEF8] bg-white p-4 shadow-md shadow-slate-900/4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {scan.product_name || "Unknown product"}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {(scan.home as Home | undefined)?.name ?? "—"} · {scan.scan_mode}
                  {scan.barcode ? ` · ${scan.barcode}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {new Date(scan.created_at).toLocaleDateString()}
              </span>
            </div>
            {(scan.quantity > 0 || scan.storage_location) && (
              <p className="mt-2 text-xs text-slate-500">
                {scan.quantity} {scan.unit}
                {scan.storage_location ? ` · ${scan.storage_location}` : ""}
              </p>
            )}
          </div>
        ))
      )}
    </AppShell>
  )
}

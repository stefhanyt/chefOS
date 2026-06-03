"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import { createClient } from "@/lib/supabase/client"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { fetchBarcodeScans } from "@/lib/supabase/list-fetch"
import { useToast } from "@/components/ToastProvider"
import { CONFIG_ERROR } from "@/lib/constants"
import type { BarcodeScan, Home } from "@/lib/types"
import { ChevronLeft } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"
import EmptyState from "@/components/EmptyState"
import { SkeletonList } from "@/components/Skeleton"
import { ui } from "@/lib/ui"

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
        const homesRes = await supabase
          .from("homes")
          .select("id, name, location, owner_id")
          .is("archived_at", null)
        const homeList = (homesRes.data as Home[]) ?? []
        const { data, error: dbError } = await fetchBarcodeScans(
          supabase,
          homeList,
        )
        if (dbError) throw dbError
        setScans(data)
      } catch (err) {
        logSupabaseError("scan history load", err)
        setError("Failed to load scan history.")
        showError(getSupabaseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount])

  return (
    <AppShell>
      <Link
        href="/scan"
        className="mb-5 flex items-center gap-1.5 text-sm font-semibold text-navy-light"
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
        <SkeletonList count={3} />
      ) : scans.length === 0 ? (
        <EmptyState message="No scans yet. Use the scanner to add items to the pantry." />
      ) : (
        scans.map((scan) => (
          <div key={scan.id} className={`${ui.cardElevated} mb-3 p-4`}>
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

"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { CONFIG_ERROR } from "@/lib/constants"
import { ui } from "@/lib/ui"

type ActivityRow = {
  id: string
  summary: string
  created_at: string
  profile?: { display_name: string } | null
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return "Just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export default function ActivityLogPanel({
  homeId,
  limit = 12,
}: {
  homeId: string
  limit?: number
}) {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      if (!supabase) {
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from("residence_activity")
        .select("id, summary, created_at")
        .eq("home_id", homeId)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (!error) setRows((data as ActivityRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [homeId, limit])

  return (
    <section className="mb-6">
      <h2 className={`${ui.sectionTitle} mb-3`}>Recent activity</h2>
      <div className={`${ui.cardInset} overflow-hidden`}>
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-stone-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-stone-400">
            Activity will appear here as your team uses ChefOS.
          </p>
        ) : (
          <ul>
            {rows.map((row, i) => (
              <li
                key={row.id}
                className={`px-4 py-3.5 ${
                  i < rows.length - 1 ? "border-b border-stone-100" : ""
                }`}
              >
                <p className="text-sm text-charcoal">{row.summary}</p>
                <p className="mt-0.5 text-xs text-stone-400">
                  {formatWhen(row.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

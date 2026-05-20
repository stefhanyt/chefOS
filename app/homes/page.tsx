"use client"

import { useState, useEffect } from "react"
import AppShell from "@/components/AppShell"
import HomeCard from "@/components/HomeCard"
import PageHeader from "@/components/PageHeader"
import { mockHomes } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import type { Home } from "@/lib/types"
import { Plus } from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"

export default function HomesPage() {
  const [homes, setHomes] = useState<Home[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      if (!supabase) {
        setHomes(mockHomes)
        setLoading(false)
        return
      }
      try {
        const [homesRes, pantryRes, shoppingRes, mealsRes, membersRes] =
          await Promise.all([
            supabase.from("homes").select("*").is("archived_at", null).order("name"),
            supabase
              .from("pantry_items")
              .select("home_id")
              .in("status", ["Critical", "Out of Stock"])
              .is("archived_at", null),
            supabase
              .from("shopping_items")
              .select("home_id")
              .eq("status", "Open")
              .is("archived_at", null),
            supabase
              .from("prepared_meals")
              .select("home_id")
              .in("status", ["Use Soon", "Expired"])
              .is("archived_at", null),
            supabase.from("home_members").select("home_id").is("removed_at", null),
          ])

        if (homesRes.error) throw homesRes.error

        const count = (arr: { home_id: string }[] | null) =>
          (arr ?? []).reduce<Record<string, number>>((m, r) => {
            m[r.home_id] = (m[r.home_id] ?? 0) + 1
            return m
          }, {})

        const enriched: Home[] = (homesRes.data ?? []).map((h) => ({
          ...h,
          pantry_alert_count: count(pantryRes.data)[h.id] ?? 0,
          open_shopping_count: count(shoppingRes.data)[h.id] ?? 0,
          expiring_meal_count: count(mealsRes.data)[h.id] ?? 0,
          member_count: count(membersRes.data)[h.id] ?? 0,
        }))

        setHomes(enriched)
      } catch {
        setError("Failed to load residences. Check your connection and try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount])

  return (
    <AppShell>
      <PageHeader
        title="Residences"
        subtitle={loading ? "Loading…" : `${homes.length} home${homes.length !== 1 ? "s" : ""}`}
        action={
          <button className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30">
            <Plus size={15} />
            Add Home
          </button>
        }
      />

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-[26px] bg-slate-200"
            />
          ))}
        </div>
      ) : homes.length === 0 ? (
        <div className="rounded-[22px] border border-[#E6EEF8] bg-white p-8 text-center text-sm text-slate-400">
          No residences yet. Add your first home to get started.
        </div>
      ) : (
        homes.map((home) => <HomeCard key={home.id} home={home} />)
      )}
    </AppShell>
  )
}

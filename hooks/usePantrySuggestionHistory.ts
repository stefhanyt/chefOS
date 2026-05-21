"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { logSupabaseError } from "@/lib/supabase/errors"
import {
  buildPantrySuggestions,
  filterPantrySuggestions,
  getPantryProfileForName,
  type PantryHistoryRow,
  type PantryNameSuggestion,
} from "@/lib/suggestions/pantry-history"

export function usePantrySuggestionHistory(homeId: string) {
  const [rows, setRows] = useState<PantryHistoryRow[]>([])
  const [ready, setReady] = useState(false)

  const suggestions = useMemo(() => buildPantrySuggestions(rows), [rows])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setReady(true)
        return
      }

      const { data, error } = await supabase
        .from("pantry_items")
        .select(
          "name, unit, category, storage_location, minimum_quantity, home_id, updated_at",
        )
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(400)

      if (cancelled) return

      if (error) {
        logSupabaseError("pantry suggestion history", error)
        setRows([])
      } else {
        setRows((data as PantryHistoryRow[]) ?? [])
      }
      setReady(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    ready,
    suggestions,
    rows,
    filter: (query: string) => filterPantrySuggestions(query, suggestions),
    profileForName: (name: string) => getPantryProfileForName(name, homeId, rows),
    pickSuggestion: (s: PantryNameSuggestion) => {
      const scoped = getPantryProfileForName(s.name, homeId, rows)
      return {
        name: s.name,
        unit: scoped?.unit || s.unit,
        category: scoped?.category || s.category,
        storage_location: scoped?.storage_location || s.storage_location,
        minimum_quantity: scoped?.minimum_quantity ?? s.minimum_quantity,
      }
    },
  }
}

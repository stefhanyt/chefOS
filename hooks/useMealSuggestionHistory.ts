"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { logSupabaseError } from "@/lib/supabase/errors"
import {
  buildMealSuggestions,
  filterMealSuggestions,
  getMealProfileForName,
  type MealHistoryRow,
  type MealNameSuggestion,
} from "@/lib/suggestions/meal-history"

export function useMealSuggestionHistory(homeId: string) {
  const [rows, setRows] = useState<MealHistoryRow[]>([])
  const [ready, setReady] = useState(false)

  const suggestions = useMemo(() => buildMealSuggestions(rows), [rows])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setReady(true)
        return
      }

      const [mealsRes, dishesRes] = await Promise.all([
        supabase
          .from("prepared_meals")
          .select(
            "name, storage_location, reheating_instructions, portions, prepared_date, expiry_date, home_id, updated_at",
          )
          .is("archived_at", null)
          .order("updated_at", { ascending: false })
          .limit(300),
        supabase
          .from("dish_library")
          .select(
            "name, storage_instructions, reheating_instructions, updated_at",
          )
          .is("archived_at", null)
          .order("updated_at", { ascending: false })
          .limit(150),
      ])

      if (cancelled) return

      if (mealsRes.error) {
        logSupabaseError("meal suggestion history (meals)", mealsRes.error)
      }
      if (dishesRes.error) {
        logSupabaseError("meal suggestion history (dishes)", dishesRes.error)
      }

      const mealRows: MealHistoryRow[] = ((mealsRes.data ?? []) as Omit<
        MealHistoryRow,
        "source"
      >[]).map((r) => ({ ...r, source: "meal" as const }))

      const dishRows: MealHistoryRow[] = ((dishesRes.data ?? []) as {
        name: string
        storage_instructions?: string | null
        reheating_instructions?: string | null
      }[]).map((d) => ({
        name: d.name,
        storage_location: d.storage_instructions,
        reheating_instructions: d.reheating_instructions,
        portions: null,
        prepared_date: null,
        expiry_date: null,
        home_id: null,
        source: "dish" as const,
      }))

      setRows([...mealRows, ...dishRows])
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
    filter: (query: string) => filterMealSuggestions(query, suggestions),
    profileForName: (name: string) => getMealProfileForName(name, homeId, rows),
    pickSuggestion: (s: MealNameSuggestion) => {
      const scoped = getMealProfileForName(s.name, homeId, rows)
      const profile = scoped ?? s
      const today = new Date().toISOString().split("T")[0]
      let expiry = ""
      if (profile.shelf_life_days != null && profile.shelf_life_days >= 0) {
        const d = new Date()
        d.setDate(d.getDate() + profile.shelf_life_days)
        expiry = d.toISOString().split("T")[0]
      }
      return {
        name: s.name,
        storage_location: profile.storage_location,
        reheating_instructions: profile.reheating_instructions,
        portions: String(profile.portions || 2),
        prepared_date: today,
        expiry_date: expiry,
      }
    },
  }
}

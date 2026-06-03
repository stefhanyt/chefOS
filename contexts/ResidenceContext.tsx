"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { createClient } from "@/lib/supabase/client"
import { readActiveHomeId, writeActiveHomeId } from "@/lib/residence-storage"
import type { Home } from "@/lib/types"

type ResidenceContextValue = {
  homes: Home[]
  activeHomeId: string | null
  activeHome: Home | null
  loading: boolean
  setActiveHomeId: (id: string | null) => void
  refreshHomes: () => Promise<void>
}

const ResidenceContext = createContext<ResidenceContextValue | null>(null)

export function ResidenceProvider({ children }: { children: React.ReactNode }) {
  const [homes, setHomes] = useState<Home[]>([])
  const [activeHomeId, setActiveHomeIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshHomes = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setHomes([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from("homes")
      .select("id, name, location, owner_id")
      .is("archived_at", null)
      .order("name")
    if (!error) setHomes((data as Home[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refreshHomes()
  }, [refreshHomes])

  useEffect(() => {
    const stored = readActiveHomeId()
    if (stored && homes.some((h) => h.id === stored)) {
      setActiveHomeIdState(stored)
    } else if (homes.length === 1) {
      setActiveHomeIdState(homes[0].id)
      writeActiveHomeId(homes[0].id)
    } else if (stored && !homes.some((h) => h.id === stored)) {
      setActiveHomeIdState(null)
      writeActiveHomeId(null)
    }
  }, [homes])

  const setActiveHomeId = useCallback((id: string | null) => {
    setActiveHomeIdState(id)
    writeActiveHomeId(id)
  }, [])

  const activeHome = useMemo(
    () => homes.find((h) => h.id === activeHomeId) ?? null,
    [homes, activeHomeId],
  )

  const value = useMemo(
    () => ({
      homes,
      activeHomeId,
      activeHome,
      loading,
      setActiveHomeId,
      refreshHomes,
    }),
    [homes, activeHomeId, activeHome, loading, setActiveHomeId, refreshHomes],
  )

  return (
    <ResidenceContext.Provider value={value}>
      {children}
    </ResidenceContext.Provider>
  )
}

export function useResidence() {
  const ctx = useContext(ResidenceContext)
  if (!ctx) {
    throw new Error("useResidence must be used within ResidenceProvider")
  }
  return ctx
}

/** Filter list rows to active residence when one is selected. */
export function filterByActiveHome<T extends { home_id: string }>(
  rows: T[],
  activeHomeId: string | null,
): T[] {
  if (!activeHomeId) return rows
  return rows.filter((r) => r.home_id === activeHomeId)
}

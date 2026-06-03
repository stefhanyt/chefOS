"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import {
  buildAccessMap,
  mergeResidenceAccess,
  type MergedHomeAccess,
  type ResidenceAccess,
} from "@/lib/home-access"
import { CONFIG_ERROR } from "@/lib/constants"
import type { Home, HomeMember } from "@/lib/types"

export function useHomeAccess() {
  const [userId, setUserId] = useState<string | null>(null)
  const [homes, setHomes] = useState<Pick<Home, "id" | "owner_id">[]>([])
  const [memberships, setMemberships] = useState<HomeMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    if (!supabase) {
      setError(CONFIG_ERROR)
      setLoading(false)
      return
    }
    try {
      const uid = await getAuthUserId(supabase)
      if (!uid) {
        setUserId(null)
        setHomes([])
        setMemberships([])
        setLoading(false)
        return
      }
      setUserId(uid)
      const [homesRes, membersRes] = await Promise.all([
        supabase
          .from("homes")
          .select("id, owner_id")
          .is("archived_at", null)
          .order("name"),
        supabase
          .from("home_members")
          .select("id, home_id, user_id, role, can_edit_pantry, can_add_shopping_items, can_log_meals")
          .eq("user_id", uid)
          .is("removed_at", null),
      ])
      if (homesRes.error) throw homesRes.error
      if (membersRes.error) throw membersRes.error
      setHomes((homesRes.data as Pick<Home, "id" | "owner_id">[]) ?? [])
      setMemberships((membersRes.data as HomeMember[]) ?? [])
    } catch {
      setError("Failed to load access permissions.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const byHomeId = useMemo(() => {
    if (!userId) return new Map<string, ResidenceAccess>()
    return buildAccessMap(userId, homes, memberships)
  }, [userId, homes, memberships])

  const merged = useMemo(
    () => mergeResidenceAccess(Array.from(byHomeId.values())),
    [byHomeId],
  )

  const accessForHome = useCallback(
    (homeId: string): ResidenceAccess | undefined => byHomeId.get(homeId),
    [byHomeId],
  )

  return {
    userId,
    loading,
    error,
    reload: load,
    byHomeId,
    merged: merged as MergedHomeAccess,
    accessForHome,
  }
}

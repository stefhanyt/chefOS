"use client"

import { useState, useEffect, useCallback } from "react"
import AppShell from "@/components/AppShell"
import MobileTopBar from "@/components/MobileTopBar"
import PageHeader from "@/components/PageHeader"
import AddMenuDishModal from "@/components/AddMenuDishModal"
import ErrorBanner from "@/components/ErrorBanner"
import EmptyState from "@/components/EmptyState"
import NoHomesBanner from "@/components/NoHomesBanner"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import {
  buildWeekMenuFromItems,
  ensureWeeklyMenu,
  type MenuDishEntry,
  type WeekMenu,
} from "@/lib/supabase/menu-data"
import { fetchDishLibrary, fetchMenuItems } from "@/lib/supabase/list-fetch"
import {
  MENU_CATEGORIES,
  MENU_DAYS,
  MENU_SHORT_DAYS,
  getWeekDates,
  getWeekStart,
  formatMenuDate,
  weekLabel,
} from "@/lib/menu-utils"
import { useToast } from "@/components/ToastProvider"
import { CONFIG_ERROR } from "@/lib/constants"
import type { DishLibraryItem, Home, MenuItemRow } from "@/lib/types"
import { ChevronLeft, ChevronRight, X, Check } from "lucide-react"
import { ui } from "@/lib/ui"
import { useHomeAccess } from "@/hooks/useHomeAccess"
import { useResidence } from "@/contexts/ResidenceContext"
import CurrentResidenceBar from "@/components/CurrentResidenceBar"

const PORTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12]

export default function MenuPage() {
  const { showSuccess, showError } = useToast()
  const { accessForHome } = useHomeAccess()
  const { activeHomeId, setActiveHomeId } = useResidence()
  const [homes, setHomes] = useState<Home[]>([])
  const [homeId, setHomeId] = useState("")
  const [weekOffset, setWeekOffset] = useState(0)
  const [view, setView] = useState<"week" | "day" | "confirmed">("week")
  const [selectedDay, setSelectedDay] = useState(0)
  const [selectedCat, setSelectedCat] = useState("")
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [menu, setMenu] = useState<WeekMenu>({})
  const [menuId, setMenuId] = useState<string | null>(null)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [dishLibrary, setDishLibrary] = useState<DishLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const dates = getWeekDates(weekOffset)
  const weekStart = getWeekStart(weekOffset)
  const home = homes.find((h) => h.id === homeId)
  const canEditMenu = accessForHome(homeId)?.canEditMenu ?? false

  const loadMenu = useCallback(async () => {
    if (!homeId) return
    const supabase = createClient()
    if (!supabase) {
      setError(CONFIG_ERROR)
      return
    }
    const { data: weeklyMenu } = await supabase
      .from("weekly_menus")
      .select("id, status")
      .eq("home_id", homeId)
      .eq("week_start", weekStart)
      .maybeSingle()

    if (!weeklyMenu) {
      setMenuId(null)
      setMenu({})
      setIsConfirmed(false)
      return
    }

    setMenuId(weeklyMenu.id)
    setIsConfirmed(weeklyMenu.status === "confirmed")

    const { data: items, error: itemsError } = await fetchMenuItems(
      supabase,
      weeklyMenu.id,
    )

    if (itemsError) {
      logSupabaseError("menu items load", itemsError)
      showError(getSupabaseErrorMessage(itemsError))
      return
    }

    setMenu(buildWeekMenuFromItems(items))
  }, [homeId, weekStart, showError])

  useEffect(() => {
    async function init() {
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
          .select("*")
          .is("archived_at", null)
          .order("name")
        if (homesRes.error) throw homesRes.error
        const list = (homesRes.data as Home[]) ?? []
        setHomes(list)
        const { data: dishes, error: dishesError } = await fetchDishLibrary(
          supabase,
        )
        if (dishesError) throw dishesError
        setDishLibrary(dishes)
        if (activeHomeId && list.some((h) => h.id === activeHomeId)) {
          setHomeId(activeHomeId)
        } else if (list[0] && !homeId) {
          setHomeId(list[0].id)
        }
      } catch (err) {
        logSupabaseError("menu init", err)
        setError("Failed to load menu data.")
        showError(getSupabaseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [retryCount, activeHomeId])

  useEffect(() => {
    if (activeHomeId && homes.some((h) => h.id === activeHomeId)) {
      setHomeId(activeHomeId)
    }
  }, [activeHomeId, homes])

  useEffect(() => {
    if (homeId) loadMenu()
  }, [homeId, weekOffset, loadMenu])

  function dayMenu(i: number) {
    return menu[i] ?? {}
  }
  function dayCount(i: number) {
    return Object.values(dayMenu(i)).reduce((s, a) => s + a.length, 0)
  }
  const totalDishes = MENU_DAYS.reduce((s, _, i) => s + dayCount(i), 0)

  async function resolveMenuId(): Promise<string | null> {
    const supabase = createClient()
    if (!supabase || !homeId) return null
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in.")
      return null
    }
    if (menuId) return menuId
    const { menuId: id, error } = await ensureWeeklyMenu(
      supabase,
      homeId,
      weekStart,
      userId,
    )
    if (error) {
      logSupabaseError("ensure weekly menu", error)
      showError(getSupabaseErrorMessage(error))
      return null
    }
    setMenuId(id)
    return id
  }

  function isDuplicateMenuEntry(
    day: number,
    cat: string,
    dishName: string,
    dishId?: string | null,
  ) {
    return (dayMenu(day)[cat] ?? []).some(
      (x) =>
        (dishId && x.dish_id === dishId) ||
        x.dish.trim().toLowerCase() === dishName.trim().toLowerCase(),
    )
  }

  async function createDishInLibrary(
    name: string,
    category: string,
  ): Promise<DishLibraryItem | null> {
    const supabase = createClient()
    if (!supabase) return null
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in.")
      return null
    }
    const { data, error } = await supabase
      .from("dish_library")
      .insert({
        name: name.trim(),
        category: category.trim() || selectedCat,
        ingredients: "",
        prep_time: "",
        storage_instructions: "",
        reheating_instructions: "",
        tags: [],
        created_by: userId,
      })
      .select("*")
      .single()
    if (error) {
      logSupabaseError("dish library insert from menu", error)
      showError(getSupabaseErrorMessage(error))
      return null
    }
    const dish = data as DishLibraryItem
    setDishLibrary((prev) =>
      [...prev, dish].sort((a, b) => a.name.localeCompare(b.name)),
    )
    showSuccess(`"${dish.name}" added to dish repertoire`)
    return dish
  }

  async function addDish(
    day: number,
    cat: string,
    dishName: string,
    dishId?: string | null,
  ) {
    if (isDuplicateMenuEntry(day, cat, dishName, dishId)) {
      showError("That dish is already on this day.")
      return
    }

    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const mid = await resolveMenuId()
    if (!mid) return

    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        menu_id: mid,
        day_of_week: day,
        category: cat,
        dish_name: dishName,
        dish_id: dishId ?? null,
        portions: 2,
        notes: "",
      })
      .select("*")
      .single()

    if (error) {
      logSupabaseError("menu item insert", error)
      showError(getSupabaseErrorMessage(error))
      return
    }

    const row = data as MenuItemRow
    setMenu((prev) => {
      const d = prev[day] ?? {}
      const catItems = d[cat] ?? []
      return {
        ...prev,
        [day]: {
          ...d,
          [cat]: [
            ...catItems,
            {
              id: row.id,
              dish: row.dish_name,
              dish_id: row.dish_id,
              portions: row.portions,
              notes: row.notes ?? "",
            },
          ],
        },
      }
    })
    await loadMenu()
  }

  async function removeDish(entryId: string, day: number, cat: string) {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const { error } = await supabase.from("menu_items").delete().eq("id", entryId)
    if (error) {
      logSupabaseError("menu item delete", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    setMenu((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [cat]: (prev[day]?.[cat] ?? []).filter((x) => x.id !== entryId),
      },
    }))
  }

  function patchMenuEntryLocal(
    entryId: string,
    field: "portions" | "notes",
    val: string | number,
  ) {
    setMenu((prev) => {
      const next = { ...prev }
      for (const day of Object.keys(next)) {
        const d = Number(day)
        for (const cat of Object.keys(next[d] ?? {})) {
          next[d][cat] = (next[d][cat] ?? []).map((x) =>
            x.id === entryId ? { ...x, [field]: val } : x,
          )
        }
      }
      return next
    })
  }

  async function updateDish(
    entryId: string,
    field: "portions" | "notes",
    val: string | number,
    opts?: { persist?: boolean },
  ) {
    patchMenuEntryLocal(entryId, field, val)
    if (opts?.persist === false) return

    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const { error } = await supabase
      .from("menu_items")
      .update({ [field]: val })
      .eq("id", entryId)
    if (error) {
      logSupabaseError("menu item update", error)
      showError(getSupabaseErrorMessage(error))
      await loadMenu()
    }
  }

  async function confirmMenu() {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const mid = await resolveMenuId()
    if (!mid) return
    const { error } = await supabase
      .from("weekly_menus")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", mid)
    if (error) {
      logSupabaseError("menu confirm", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    setIsConfirmed(true)
    showSuccess(`Menu confirmed for ${home?.name ?? "residence"}`)
    setView("confirmed")
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${ui.skeleton} h-20`} />
          ))}
        </div>
      </AppShell>
    )
  }

  if (error || homes.length === 0) {
    return (
      <AppShell>
        <PageHeader title="Weekly Menu" />
        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => setRetryCount((c) => c + 1)}
          />
        )}
        {!error && homes.length === 0 && (
          <EmptyState
            title="No residence yet"
            message="Add a home before planning weekly menus."
            action={
              <Link href="/homes" className={ui.btnPrimary}>
                Add residence
              </Link>
            }
          />
        )}
      </AppShell>
    )
  }

  if (!home) {
    return (
      <AppShell>
        <PageHeader title="Weekly Menu" />
        <NoHomesBanner />
      </AppShell>
    )
  }

  function openAddModal(day: number, cat: string) {
    setSelectedDay(day)
    setSelectedCat(cat)
    setAddModalOpen(true)
  }

  if (view === "day") {
    const dm = dayMenu(selectedDay)
    return (
      <AppShell>
        <MobileTopBar
          onBack={() => setView("week")}
          backLabel="Week"
          title={MENU_DAYS[selectedDay]}
        />
        <p className="mb-7 text-sm text-stone-500">
          {formatMenuDate(dates[selectedDay])} · {home.name}
        </p>
        {MENU_CATEGORIES.map((cat) => {
          const dishes = dm[cat] ?? []
          return (
            <div key={cat} className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {cat}
                </h3>
                {canEditMenu && (
                <button
                  type="button"
                  onClick={() => openAddModal(selectedDay, cat)}
                  className={ui.btnText}
                >
                  + Add
                </button>
                )}
              </div>
              {dishes.length === 0 ? (
                canEditMenu ? (
                <button
                  onClick={() => openAddModal(selectedDay, cat)}
                  className="w-full rounded-2xl border border-dashed border-stone-200/60 bg-slate-50 px-4 py-3.5 text-left text-sm text-slate-400"
                >
                  No {cat.toLowerCase()} — tap to add from repertoire
                </button>
                ) : (
                <div className="w-full rounded-2xl border border-dashed border-stone-200/60 bg-slate-50 px-4 py-3.5 text-sm text-slate-400">
                  No {cat.toLowerCase()} planned
                </div>
                )
              ) : (
                dishes.map((entry) => (
                  <div
                    key={entry.id}
                    className="mb-3 rounded-[20px] border border-stone-200/60 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-3">
                        <p className="mb-1 font-display text-lg font-semibold text-charcoal">
                          {entry.dish}
                        </p>
                        {entry.dish_id && (
                          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-stone-400">
                            From dish repertoire
                          </p>
                        )}
                        {!entry.dish_id && <div className="mb-3" />}
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                          Portions
                        </p>
                        {canEditMenu ? (
                        <>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {PORTIONS.map((p) => (
                            <button
                              key={p}
                              onClick={() => updateDish(entry.id, "portions", p)}
                              className={`h-11 min-h-[44px] w-11 min-w-[44px] rounded-lg text-xs font-bold transition-all ${
                                entry.portions === p
                                  ? "bg-navy text-white"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <input
                          value={entry.notes}
                          onChange={(e) =>
                            updateDish(entry.id, "notes", e.target.value, {
                              persist: false,
                            })
                          }
                          onBlur={(e) =>
                            updateDish(entry.id, "notes", e.target.value)
                          }
                          placeholder="Notes — dietary restrictions, guests..."
                          className="w-full rounded-xl border border-stone-200/60 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        </>
                        ) : (
                          <p className="text-xs text-slate-500">
                            {entry.portions} portions
                            {entry.notes ? ` · ${entry.notes}` : ""}
                          </p>
                        )}
                      </div>
                      {canEditMenu && (
                      <button
                        onClick={() => removeDish(entry.id, selectedDay, cat)}
                        className="flex h-11 min-h-[44px] w-11 min-w-[44px] flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500"
                      >
                        <X size={13} />
                      </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        })}

        <AddMenuDishModal
          open={addModalOpen && canEditMenu}
          onClose={() => setAddModalOpen(false)}
          menuCategory={selectedCat}
          dayLabel={`${MENU_DAYS[selectedDay]} · ${home.name}`}
          dishes={dishLibrary}
          alreadyAdded={dayMenu(selectedDay)[selectedCat] ?? []}
          onSelectDish={(dish) =>
            addDish(selectedDay, selectedCat, dish.name, dish.id)
          }
          onAddManual={(name) => addDish(selectedDay, selectedCat, name, null)}
          onCreateDish={createDishInLibrary}
        />
      </AppShell>
    )
  }

  if (view === "confirmed") {
    return (
      <AppShell>
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check size={28} className="text-green-600" />
          </div>
          <h2 className="mb-1 text-xl font-semibold text-slate-900">Menu Confirmed</h2>
          <p className="text-sm text-slate-500">
            {home.name} · {formatMenuDate(dates[0])} — {formatMenuDate(dates[6])}
          </p>
          <p className="mt-1 text-xs text-slate-400">{totalDishes} dishes saved</p>
        </div>
        {MENU_DAYS.map((day, i) => {
          const dm = dayMenu(i)
          if (dayCount(i) === 0) return null
          return (
            <div
              key={day}
              className="mb-3 rounded-[20px] border border-stone-200/60 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{day}</h3>
                <span className="text-xs text-slate-400">{formatMenuDate(dates[i])}</span>
              </div>
              {MENU_CATEGORIES.map((cat) => {
                const dishes = dm[cat] ?? []
                if (!dishes.length) return null
                return (
                  <div key={cat} className="mb-3">
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                      {cat}
                    </p>
                    {dishes.map((entry) => (
                      <div
                        key={entry.id}
                        className="mb-1.5 flex items-start justify-between"
                      >
                        <div>
                          <p className="font-display text-base font-semibold text-charcoal">
                            {entry.dish}
                          </p>
                          {entry.notes && (
                            <p className="mt-0.5 text-xs text-slate-400">{entry.notes}</p>
                          )}
                        </div>
                        <span className="ml-3 flex-shrink-0 rounded-full bg-navy/5 px-2 py-0.5 text-xs font-bold text-navy-light">
                          {entry.portions} portions
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
        <button
          onClick={() => setView("week")}
          className="mt-4 w-full rounded-2xl border border-stone-200/60 bg-white py-3.5 text-sm font-bold text-slate-500"
        >
          Back to Week View
        </button>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <CurrentResidenceBar showAllOption={false} />
      <div className={`chef-hero-bleed mb-7 rounded-b-3xl pb-6 ${ui.hero}`}>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest opacity-60">
          Weekly Menu
        </p>
        <h1 className="mb-1 font-display text-2xl font-semibold">{home.name}</h1>
        <p className="mb-4 text-sm opacity-70">
          {formatMenuDate(dates[0])} — {formatMenuDate(dates[6])}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {homes.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                setHomeId(h.id)
                setActiveHomeId(h.id)
              }}
              className={`min-h-[44px] flex-shrink-0 rounded-full px-4 py-2.5 text-xs font-bold transition-all ${
                homeId === h.id
                  ? "bg-surface text-navy"
                  : "border border-white/25 bg-white/10 text-white"
              }`}
            >
              {h.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between rounded-2xl border border-stone-200/60 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          className={`${ui.btnIcon} text-slate-500`}
          aria-label="Previous week"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">{weekLabel(weekOffset)}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatMenuDate(dates[0])} — {formatMenuDate(dates[6])}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          className={`${ui.btnIcon} text-slate-500`}
          aria-label="Next week"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mb-5 grid grid-cols-7 gap-1.5">
        {MENU_DAYS.map((_, i) => {
          const count = dayCount(i)
          return (
            <button
              key={i}
              onClick={() => {
                setSelectedDay(i)
                setView("day")
              }}
              className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 transition-all ${
                count > 0
                  ? "border-2 border-blue-600 bg-navy/5"
                  : "border-stone-200/60 bg-white"
              }`}
            >
              <span
                className={`text-[9px] font-bold uppercase tracking-wide ${
                  count > 0 ? "text-navy-light" : "text-slate-400"
                }`}
              >
                {MENU_SHORT_DAYS[i]}
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {formatMenuDate(dates[i]).split(" ")[1]}
              </span>
              {count > 0 ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-white">
                  {count}
                </span>
              ) : (
                <span className="h-5 w-5 rounded-full bg-slate-100" />
              )}
            </button>
          )
        })}
      </div>

      {MENU_DAYS.map((day, i) => {
        const dm = dayMenu(i)
        if (dayCount(i) === 0) return null
        return (
          <button
            key={day}
            onClick={() => {
              setSelectedDay(i)
              setView("day")
            }}
            className="mb-3 w-full rounded-[20px] border border-stone-200/60 bg-white p-4 text-left shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{day}</p>
              <span className="text-xs text-slate-400">{formatMenuDate(dates[i])}</span>
            </div>
            {MENU_CATEGORIES.map((cat) => {
              const dishes = dm[cat] ?? []
              if (!dishes.length) return null
              return (
                <div key={cat} className="mb-1">
                  <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {cat}
                  </span>
                  <ul className="mt-1 space-y-0.5">
                    {dishes.map((d) => (
                      <li
                        key={d.id}
                        className="font-display text-sm font-semibold text-charcoal"
                      >
                        {d.dish}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </button>
        )
      })}

      {totalDishes === 0 && (
        <div className="rounded-[20px] border border-dashed border-stone-200/60 bg-white p-8 text-center">
          <p className="mb-1 text-sm font-bold text-slate-500">No menu planned yet</p>
          <p className="text-xs text-slate-400">
            Tap any day to start building the menu for {home.name}
          </p>
        </div>
      )}

      {totalDishes > 0 && !isConfirmed && canEditMenu && (
        <div className="mt-4">
          <button
            onClick={confirmMenu}
            className="w-full rounded-2xl bg-navy py-4 text-sm font-semibold text-white shadow-soft"
          >
            Confirm Menu — {totalDishes} dishes
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">
            Saves the menu for {home.name}
          </p>
        </div>
      )}

      {isConfirmed && (
        <div className="mt-4">
          <button
            onClick={() => setView("confirmed")}
            className="w-full rounded-xl border border-stone-200/60 bg-stone-100/80 py-4 text-sm font-semibold text-stone-600"
          >
            Menu Confirmed — View Summary
          </button>
        </div>
      )}
    </AppShell>
  )
}

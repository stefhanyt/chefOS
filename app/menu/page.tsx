"use client"

import { useState } from "react"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import { mockHomes, mockDishLibrary } from "@/lib/mock-data"
import { ChevronLeft, ChevronRight, Plus, X, Check } from "lucide-react"

const CATEGORIES = ["Mains", "Sides", "Soups", "Desserts", "Sauces & Condiments"]

const DISH_LIBRARY: Record<string, string[]> = {
  Mains: ["Lemon Herb Salmon", "Truffle Risotto", "Beef Tenderloin", "Roasted Chicken", "Seared Scallops", "Lamb Rack", "Sea Bass en Papillote", "Duck Confit"],
  Sides: ["Roasted Root Vegetables", "Sauteed Broccolini", "Truffle Mashed Potato", "Wild Rice Pilaf", "Grilled Asparagus", "Glazed Carrots", "Cauliflower Gratin"],
  Soups: ["Chicken Soup", "French Onion", "Butternut Squash", "Lobster Bisque", "Minestrone"],
  Desserts: ["Chocolate Fondant", "Panna Cotta", "Tarte Tatin", "Lemon Posset", "Cheese Board", "Seasonal Fruit Plate"],
  "Sauces & Condiments": ["Bearnaise", "Red Wine Jus", "Chimichurri", "Truffle Butter", "Salsa Verde", "Hollandaise"],
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const PORTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12]

interface DishEntry {
  dish: string
  portions: number
  notes: string
}

type DayMenu = Record<string, DishEntry[]>
type WeekMenu = Record<number, DayMenu>
type AllMenus = Record<string, WeekMenu>

function getWeekDates(offset: number): Date[] {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7)
  return DAYS.map((_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function fmt(d: Date) {
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
}

function weekLabel(offset: number) {
  if (offset === 0) return "This Week"
  if (offset === 1) return "Next Week"
  if (offset === -1) return "Last Week"
  return `Week ${offset > 0 ? "+" : ""}${offset}`
}

export default function MenuPage() {
  const [homeId, setHomeId] = useState(mockHomes[0].id)
  const [weekOffset, setWeekOffset] = useState(0)
  const [view, setView] = useState<"week" | "day" | "picker" | "confirmed">("week")
  const [selectedDay, setSelectedDay] = useState(0)
  const [selectedCat, setSelectedCat] = useState("")
  const [menus, setMenus] = useState<AllMenus>({})
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState(false)

  const home = mockHomes.find(h => h.id === homeId) ?? mockHomes[0]
  const weekKey = `${homeId}-${weekOffset}`
  const dates = getWeekDates(weekOffset)
  const menu: WeekMenu = menus[weekKey] ?? {}
  const isConfirmed = !!confirmed[weekKey]

  function dayMenu(i: number): DayMenu { return menu[i] ?? {} }
  function dayCount(i: number) { return Object.values(dayMenu(i)).reduce((s, a) => s + a.length, 0) }
  const totalDishes = DAYS.reduce((s, _, i) => s + dayCount(i), 0)

  function addDish(day: number, cat: string, dish: string) {
    setMenus(prev => {
      const wk = prev[weekKey] ?? {}
      const d = wk[day] ?? {}
      const ex = d[cat] ?? []
      if (ex.find(x => x.dish === dish)) return prev
      return { ...prev, [weekKey]: { ...wk, [day]: { ...d, [cat]: [...ex, { dish, portions: 2, notes: "" }] } } }
    })
  }

  function removeDish(day: number, cat: string, dish: string) {
    setMenus(prev => {
      const wk = prev[weekKey] ?? {}
      const d = wk[day] ?? {}
      return { ...prev, [weekKey]: { ...wk, [day]: { ...d, [cat]: (d[cat] ?? []).filter(x => x.dish !== dish) } } }
    })
  }

  function updateDish(day: number, cat: string, dish: string, field: "portions" | "notes", val: string | number) {
    setMenus(prev => {
      const wk = prev[weekKey] ?? {}
      const d = wk[day] ?? {}
      return { ...prev, [weekKey]: { ...wk, [day]: { ...d, [cat]: (d[cat] ?? []).map(x => x.dish === dish ? { ...x, [field]: val } : x) } } }
    })
  }

  function confirmMenu() {
    setConfirmed(prev => ({ ...prev, [weekKey]: true }))
    setToast(true)
    setTimeout(() => setToast(false), 4000)
    setView("confirmed")
  }

  // DISH PICKER
  if (view === "picker") {
    const available = DISH_LIBRARY[selectedCat] ?? []
    const selDishes = (dayMenu(selectedDay)[selectedCat] ?? []).map(d => d.dish)
    return (
      <AppShell>
        <button onClick={() => setView("day")} className="flex items-center gap-1.5 text-sm font-bold text-blue-600 mb-4">
          <ChevronLeft size={16} /> Back
        </button>
        <PageHeader title={selectedCat} subtitle={`${DAYS[selectedDay]} · ${home.name}`} />
        <div className="space-y-2">
          {available.map(dish => {
            const on = selDishes.includes(dish)
            return (
              <button key={dish} onClick={() => on ? removeDish(selectedDay, selectedCat, dish) : addDish(selectedDay, selectedCat, dish)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-left transition-all ${on ? "border-blue-600 bg-blue-50 border-2" : "border-[#E6EEF8] bg-white"}`}>
                <span className={`text-sm font-semibold ${on ? "text-blue-600" : "text-slate-700"}`}>{dish}</span>
                {on && <span className="text-xs font-bold text-blue-600">Selected</span>}
              </button>
            )
          })}
        </div>
        <button onClick={() => setView("day")} className="mt-6 w-full rounded-2xl bg-blue-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30">
          Done — {selDishes.length} selected
        </button>
      </AppShell>
    )
  }

  // DAY VIEW
  if (view === "day") {
    const dm = dayMenu(selectedDay)
    return (
      <AppShell>
        <button onClick={() => setView("week")} className="flex items-center gap-1.5 text-sm font-bold text-blue-600 mb-4">
          <ChevronLeft size={16} /> Week View
        </button>
        <PageHeader title={DAYS[selectedDay]} subtitle={`${fmt(dates[selectedDay])} · ${home.name}`} />
        {CATEGORIES.map(cat => {
          const dishes = dm[cat] ?? []
          return (
            <div key={cat} className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">{cat}</h3>
                <button onClick={() => { setSelectedCat(cat); setView("picker") }} className="text-xs font-bold text-blue-600">+ Add</button>
              </div>
              {dishes.length === 0 ? (
                <button onClick={() => { setSelectedCat(cat); setView("picker") }}
                  className="w-full px-4 py-3.5 rounded-2xl border border-dashed border-[#E6EEF8] bg-slate-50 text-sm text-slate-400 text-left">
                  No {cat.toLowerCase()} — tap to add
                </button>
              ) : (
                dishes.map(({ dish, portions, notes }) => (
                  <div key={dish} className="mb-3 rounded-[20px] border border-[#E6EEF8] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-3">
                        <p className="text-sm font-bold text-slate-900 mb-3">{dish}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Portions</p>
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          {PORTIONS.map(p => (
                            <button key={p} onClick={() => updateDish(selectedDay, cat, dish, "portions", p)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${portions === p ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                              {p}
                            </button>
                          ))}
                        </div>
                        <input value={notes} onChange={e => updateDish(selectedDay, cat, dish, "notes", e.target.value)}
                          placeholder="Notes — dietary restrictions, guests..."
                          className="w-full rounded-xl border border-[#E6EEF8] bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                      </div>
                      <button onClick={() => removeDish(selectedDay, cat, dish)}
                        className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </AppShell>
    )
  }

  // CONFIRMED VIEW
  if (view === "confirmed") {
    return (
      <AppShell>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-green-600" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-1">Menu Confirmed</h2>
          <p className="text-sm text-slate-500">{home.name} · {fmt(dates[0])} — {fmt(dates[6])}</p>
          <p className="text-xs text-slate-400 mt-1">{totalDishes} dishes · team notified</p>
        </div>
        {DAYS.map((day, i) => {
          const dm = dayMenu(i)
          if (dayCount(i) === 0) return null
          return (
            <div key={day} className="mb-3 rounded-[20px] border border-[#E6EEF8] bg-white p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-extrabold text-slate-900">{day}</h3>
                <span className="text-xs text-slate-400">{fmt(dates[i])}</span>
              </div>
              {CATEGORIES.map(cat => {
                const dishes = dm[cat] ?? []
                if (!dishes.length) return null
                return (
                  <div key={cat} className="mb-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{cat}</p>
                    {dishes.map(({ dish, portions, notes }) => (
                      <div key={dish} className="flex justify-between items-start mb-1.5">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{dish}</p>
                          {notes && <p className="text-xs text-slate-400 mt-0.5">{notes}</p>}
                        </div>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 ml-3 flex-shrink-0">
                          {portions} portions
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
        <button onClick={() => setView("week")} className="w-full mt-4 rounded-2xl border border-[#E6EEF8] bg-white py-3.5 text-sm font-bold text-slate-500">
          Back to Week View
        </button>
      </AppShell>
    )
  }

  // WEEK VIEW
  return (
    <AppShell>
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto bg-[#0F2A55] text-white rounded-2xl px-4 py-3.5 text-sm font-semibold shadow-2xl">
          Menu confirmed and logged for {home.name}
        </div>
      )}

      {/* HERO */}
      <div className="-mx-4 -mt-4 mb-6 rounded-b-[28px] bg-gradient-to-br from-[#0F2A55] to-[#2563EB] px-5 pt-6 pb-6 text-white shadow-xl shadow-blue-500/20">
        <p className="text-xs font-bold opacity-60 uppercase tracking-widest mb-1">Weekly Menu</p>
        <h1 className="text-2xl font-extrabold mb-1">{home.name}</h1>
        <p className="text-sm opacity-70 mb-4">{fmt(dates[0])} — {fmt(dates[6])}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {mockHomes.map(h => (
            <button key={h.id} onClick={() => setHomeId(h.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${homeId === h.id ? "bg-white text-[#0F2A55]" : "bg-white/10 text-white border border-white/25"}`}>
              {h.name}
            </button>
          ))}
        </div>
      </div>

      {/* WEEK NAV */}
      <div className="flex items-center justify-between mb-5 rounded-2xl border border-[#E6EEF8] bg-white px-4 py-3 shadow-sm">
        <button onClick={() => setWeekOffset(w => w - 1)} className="text-slate-400 p-1"><ChevronLeft size={20} /></button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">{weekLabel(weekOffset)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmt(dates[0])} — {fmt(dates[6])}</p>
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} className="text-slate-400 p-1"><ChevronRight size={20} /></button>
      </div>

      {/* DAY GRID */}
      <div className="grid grid-cols-7 gap-1.5 mb-5">
        {DAYS.map((_, i) => {
          const count = dayCount(i)
          return (
            <button key={i} onClick={() => { setSelectedDay(i); setView("day") }}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl border transition-all ${count > 0 ? "border-blue-600 bg-blue-50 border-2" : "border-[#E6EEF8] bg-white"}`}>
              <span className={`text-[9px] font-bold uppercase tracking-wide ${count > 0 ? "text-blue-600" : "text-slate-400"}`}>{SHORT_DAYS[i]}</span>
              <span className="text-xs font-extrabold text-slate-800">{fmt(dates[i]).split(" ")[1]}</span>
              {count > 0
                ? <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center">{count}</span>
                : <span className="w-5 h-5 rounded-full bg-slate-100" />
              }
            </button>
          )
        })}
      </div>

      {/* DAY SUMMARIES */}
      {DAYS.map((day, i) => {
        const dm = dayMenu(i)
        if (dayCount(i) === 0) return null
        return (
          <button key={day} onClick={() => { setSelectedDay(i); setView("day") }}
            className="w-full mb-3 rounded-[20px] border border-[#E6EEF8] bg-white p-4 shadow-sm text-left">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-extrabold text-slate-900">{day}</p>
              <span className="text-xs text-slate-400">{fmt(dates[i])}</span>
            </div>
            {CATEGORIES.map(cat => {
              const dishes = dm[cat] ?? []
              if (!dishes.length) return null
              return (
                <div key={cat} className="mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1.5">{cat}</span>
                  <span className="text-xs text-slate-600">{dishes.map(d => d.dish).join(", ")}</span>
                </div>
              )
            })}
          </button>
        )
      })}

      {totalDishes === 0 && (
        <div className="rounded-[20px] border border-dashed border-[#E6EEF8] bg-white p-8 text-center">
          <p className="text-sm font-bold text-slate-500 mb-1">No menu planned yet</p>
          <p className="text-xs text-slate-400">Tap any day to start building the menu for {home.name}</p>
        </div>
      )}

      {totalDishes > 0 && !isConfirmed && (
        <div className="mt-4">
          <button onClick={confirmMenu} className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30">
            Confirm Menu — {totalDishes} dishes
          </button>
          <p className="text-xs text-slate-400 text-center mt-2">Logs the menu for {home.name} and notifies the team</p>
        </div>
      )}

      {isConfirmed && (
        <div className="mt-4">
          <button onClick={() => setView("confirmed")} className="w-full rounded-2xl bg-green-100 py-4 text-sm font-extrabold text-green-700">
            Menu Confirmed — View Summary
          </button>
        </div>
      )}
    </AppShell>
  )
}

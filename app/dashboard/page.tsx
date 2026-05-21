"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, UtensilsCrossed, ScanLine, ShoppingCart } from "lucide-react"
import AppShell from "@/components/AppShell"
import StatusBadge, { pantryStatusType, mealStatusType } from "@/components/StatusBadge"
import ErrorBanner from "@/components/ErrorBanner"
import { useToast } from "@/components/ToastProvider"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import type { Home, PantryItem, ShoppingItem, PreparedMeal } from "@/lib/types"

const CONFIG_ERROR =
  "Database not configured. Add Supabase credentials to .env.local and restart the dev server."

export default function DashboardPage() {
  const { showError } = useToast()
  const [homes, setHomes] = useState<Home[]>([])
  const [alerts, setAlerts] = useState<PantryItem[]>([])
  const [openShopping, setOpenShopping] = useState<ShoppingItem[]>([])
  const [expiringSoon, setExpiringSoon] = useState<PreparedMeal[]>([])
  const [userInitial, setUserInitial] = useState("C")
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
        const userId = await getAuthUserId(supabase)
        const [homesRes, alertsRes, shoppingRes, mealsRes, profileRes] =
          await Promise.all([
            supabase.from("homes").select("*").is("archived_at", null).order("name").limit(10),
            supabase
              .from("pantry_items")
              .select("*, home:homes(id, name, location)")
              .in("status", ["Critical", "Out of Stock"])
              .is("archived_at", null)
              .limit(5),
            supabase
              .from("shopping_items")
              .select("*, home:homes(id, name, location), added_by_profile:profiles!added_by(id, display_name, email)")
              .eq("status", "Open")
              .is("archived_at", null)
              .limit(4),
            supabase
              .from("prepared_meals")
              .select("*, home:homes(id, name, location)")
              .in("status", ["Use Soon", "Expired"])
              .is("archived_at", null)
              .limit(5),
            userId
              ? supabase
                  .from("profiles")
                  .select("display_name")
                  .eq("id", userId)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
          ])

        if (homesRes.error) throw homesRes.error
        setHomes(homesRes.data ?? [])
        setAlerts((alertsRes.data as PantryItem[]) ?? [])
        setOpenShopping((shoppingRes.data as ShoppingItem[]) ?? [])
        setExpiringSoon((mealsRes.data as PreparedMeal[]) ?? [])
        if (profileRes.data?.display_name) {
          setUserInitial(profileRes.data.display_name.charAt(0).toUpperCase())
        }
      } catch (err) {
        logSupabaseError("dashboard load", err)
        const msg = getSupabaseErrorMessage(err)
        setError("Failed to load dashboard. Check your connection and try again.")
        showError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount, showError])

  return (
    <AppShell>
      <section className="rounded-[30px] bg-gradient-to-br from-[#0F2A55] to-[#2563EB] p-7 text-white shadow-2xl shadow-blue-500/20">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight">ChefOS</h1>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 font-bold backdrop-blur-md">
            {userInitial}
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-blue-100">
          {loading
            ? "Loading…"
            : `Private chef command center · ${homes.length} residence${homes.length !== 1 ? "s" : ""} active`}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <QuickAction href="/pantry" icon={<Plus size={18} />} label="Pantry Item" />
          <QuickAction
            href="/meals"
            icon={<UtensilsCrossed size={18} />}
            label="Log Meal"
          />
          <QuickAction href="/scan" icon={<ScanLine size={18} />} label="Scan Item" />
          <QuickAction
            href="/scan/batch"
            icon={<ShoppingCart size={18} />}
            label="Batch Scan"
          />
        </div>
      </section>

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => setRetryCount((c) => c + 1)}
        />
      )}

      {loading ? (
        <div className="mt-7 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[22px] bg-slate-200" />
          ))}
        </div>
      ) : (
        <>
          <Section title="Residences" seeAllHref="/homes">
            {homes.map((home) => (
              <Link key={home.id} href={`/homes/${home.id}`}>
                <div className="mb-3 rounded-[22px] border border-[#E6EEF8] bg-white p-4 shadow-md shadow-slate-900/4 transition-transform active:scale-[0.98]">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-900">{home.name}</h3>
                    <StatusBadge
                      label={
                        (home.pantry_alert_count ?? 0) > 0
                          ? "Needs Attention"
                          : "Active"
                      }
                      type={
                        (home.pantry_alert_count ?? 0) > 0 ? "low" : "blue"
                      }
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {home.pantry_alert_count ?? 0} pantry alerts ·{" "}
                    {home.expiring_meal_count ?? 0} meals expiring ·{" "}
                    {home.member_count ?? 0} staff
                  </p>
                </div>
              </Link>
            ))}
          </Section>

          {alerts.length > 0 && (
            <Section title="Pantry Alerts" seeAllHref="/pantry">
              {alerts.map((item) => (
                <div
                  key={item.id}
                  className="mb-3 rounded-[22px] border border-[#E6EEF8] bg-white p-4 shadow-md shadow-slate-900/4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900">{item.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {(item.home as Home | undefined)?.name} ·{" "}
                        {item.storage_location} · {item.quantity} {item.unit}{" "}
                        remaining
                      </p>
                    </div>
                    <StatusBadge
                      label={item.status}
                      type={pantryStatusType(item.status)}
                    />
                  </div>
                </div>
              ))}
            </Section>
          )}

          <Section title="Shopping List" seeAllHref="/shopping-list">
            <div className="rounded-[22px] border border-[#E6EEF8] bg-white p-4 shadow-md shadow-slate-900/4">
              {openShopping.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  Nothing open — all good!
                </p>
              ) : (
                <div className="space-y-0">
                  {openShopping.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          {(item.home as Home | undefined)?.name} · by{" "}
                          {item.added_by_profile?.display_name ?? "—"}
                        </p>
                      </div>
                      {item.priority !== "Normal" && (
                        <StatusBadge
                          label={item.priority}
                          type={
                            item.priority === "Urgent" ? "critical" : "warning"
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {expiringSoon.length > 0 && (
            <Section title="Meals Expiring Soon" seeAllHref="/meals">
              {expiringSoon.map((meal) => (
                <div
                  key={meal.id}
                  className="mb-3 rounded-[22px] border border-[#E6EEF8] bg-white p-4 shadow-md shadow-slate-900/4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900">{meal.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {(meal.home as Home | undefined)?.name} · {meal.portions}{" "}
                        portions
                      </p>
                    </div>
                    <StatusBadge
                      label={meal.status}
                      type={mealStatusType(meal.status)}
                    />
                  </div>
                </div>
              ))}
            </Section>
          )}
        </>
      )}

      <Link href="/scan">
        <button className="fixed bottom-28 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white shadow-2xl shadow-blue-500/40">
          <ScanLine size={24} />
        </button>
      </Link>
    </AppShell>
  )
}

function Section({
  title,
  seeAllHref,
  children,
}: {
  title: string
  seeAllHref?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-7">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="inline-flex min-h-[44px] items-center text-sm font-bold text-blue-600"
          >
            See all
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link href={href}>
      <button className="flex w-full flex-col items-center justify-center gap-2 rounded-[22px] bg-white/15 p-5 text-sm font-bold backdrop-blur-md transition-colors active:bg-white/25">
        {icon}
        {label}
      </button>
    </Link>
  )
}

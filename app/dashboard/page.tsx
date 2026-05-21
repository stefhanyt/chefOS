"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, UtensilsCrossed, ScanLine, ShoppingCart } from "lucide-react"
import AppShell from "@/components/AppShell"
import StatusBadge, { pantryStatusType, mealStatusType } from "@/components/StatusBadge"
import ErrorBanner from "@/components/ErrorBanner"
import { SkeletonList } from "@/components/Skeleton"
import { useToast } from "@/components/ToastProvider"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { ui } from "@/lib/ui"
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
        setError("Failed to load dashboard. Check your connection and try again.")
        showError(getSupabaseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount])

  return (
    <AppShell>
      <section className={ui.hero}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-light/90">
              Command center
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
              ChefOS
            </h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-ivory/25 bg-ivory/10 font-display text-lg font-semibold text-ivory backdrop-blur-sm">
            {userInitial}
          </div>
        </div>
        <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-ivory/75">
          {loading
            ? "Loading household status…"
            : `${homes.length} active residence${homes.length !== 1 ? "s" : ""} · pantry, meals & shopping`}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <QuickAction href="/pantry" icon={<Plus size={18} strokeWidth={1.5} />} label="Pantry" />
          <QuickAction href="/meals" icon={<UtensilsCrossed size={18} strokeWidth={1.5} />} label="Log meal" />
          <QuickAction href="/scan" icon={<ScanLine size={18} strokeWidth={1.5} />} label="Scan" />
          <QuickAction href="/scan/batch" icon={<ShoppingCart size={18} strokeWidth={1.5} />} label="Batch" />
        </div>
      </section>

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      {loading ? (
        <div className="mt-8">
          <SkeletonList count={4} className="h-[4.5rem]" />
        </div>
      ) : (
        <>
          <Section title="Residences" seeAllHref="/homes">
            {homes.length === 0 ? (
              <p className="chef-empty text-sm text-stone-500">
                No residences yet. Add one under Settings → Homes.
              </p>
            ) : (
              homes.map((home) => (
                <Link key={home.id} href={`/homes/${home.id}`}>
                  <div className={`${ui.cardElevated} mb-3 p-4 transition active:scale-[0.99]`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-charcoal">{home.name}</h3>
                      <StatusBadge
                        label={
                          (home.pantry_alert_count ?? 0) > 0 ? "Attention" : "In order"
                        }
                        type={(home.pantry_alert_count ?? 0) > 0 ? "low" : "ok"}
                      />
                    </div>
                    <p className="mt-2 text-sm text-stone-500">
                      {home.pantry_alert_count ?? 0} pantry alerts ·{" "}
                      {home.expiring_meal_count ?? 0} meals · {home.member_count ?? 0} staff
                    </p>
                  </div>
                </Link>
              ))
            )}
          </Section>

          {alerts.length > 0 && (
            <Section title="Pantry alerts" seeAllHref="/pantry">
              {alerts.map((item) => (
                <div key={item.id} className={`${ui.cardElevated} mb-3 p-4`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-charcoal">{item.name}</h3>
                      <p className="mt-1 text-sm text-stone-500">
                        {(item.home as Home | undefined)?.name} · {item.quantity}{" "}
                        {item.unit}
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

          <Section title="Shopping" seeAllHref="/shopping-list">
            <div className={ui.cardInset}>
              {openShopping.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-stone-500">
                  Nothing open — all caught up.
                </p>
              ) : (
                <div className="px-4">
                  {openShopping.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border-b border-stone-100 py-3.5 last:border-0"
                    >
                      <div>
                        <p className="font-semibold text-charcoal">{item.name}</p>
                        <p className="text-xs text-stone-500">
                          {(item.home as Home | undefined)?.name}
                        </p>
                      </div>
                      {item.priority !== "Normal" && (
                        <StatusBadge
                          label={item.priority}
                          type={item.priority === "Urgent" ? "critical" : "warning"}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {expiringSoon.length > 0 && (
            <Section title="Meals expiring" seeAllHref="/meals">
              {expiringSoon.map((meal) => (
                <div key={meal.id} className={`${ui.cardElevated} mb-3 p-4`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-charcoal">{meal.name}</h3>
                      <p className="mt-1 text-sm text-stone-500">
                        {(meal.home as Home | undefined)?.name} · {meal.portions} portions
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

      <Link
        href="/scan"
        className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-navy text-ivory shadow-soft ring-2 ring-gold/30 transition active:scale-95"
        aria-label="Scan item"
      >
        <ScanLine size={22} strokeWidth={1.5} />
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
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={ui.sectionTitle}>{title}</h2>
        {seeAllHref && (
          <Link href={seeAllHref} className={ui.link}>
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
      <span className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-ivory/15 bg-ivory/10 py-4 text-xs font-semibold text-ivory backdrop-blur-sm transition active:bg-ivory/20">
        {icon}
        {label}
      </span>
    </Link>
  )
}

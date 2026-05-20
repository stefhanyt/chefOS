"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import AppShell from "@/components/AppShell"
import StatusBadge, { pantryStatusType, mealStatusType } from "@/components/StatusBadge"
import {
  mockHomes,
  mockPantryItems,
  mockShoppingItems,
  mockMeals,
  mockHomeMembers,
} from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import type {
  Home,
  PantryItem,
  ShoppingItem,
  PreparedMeal,
  HomeMember,
} from "@/lib/types"
import {
  MapPin,
  ChevronLeft,
  Users,
  Package,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"

export default function HomeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [home, setHome] = useState<Home | null>(null)
  const [alerts, setAlerts] = useState<PantryItem[]>([])
  const [shopping, setShopping] = useState<ShoppingItem[]>([])
  const [meals, setMeals] = useState<PreparedMeal[]>([])
  const [members, setMembers] = useState<HomeMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [notFoundFlag, setNotFoundFlag] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      if (!supabase) {
        const h = mockHomes.find((h) => h.id === id)
        if (!h) { setNotFoundFlag(true); setLoading(false); return }
        setHome(h)
        setAlerts(
          mockPantryItems.filter(
            (i) => i.home_id === id && (i.status === "Critical" || i.status === "Out of Stock")
          )
        )
        setShopping(mockShoppingItems.filter((i) => i.home_id === id && i.status === "Open"))
        setMeals(mockMeals.filter((m) => m.home_id === id))
        setMembers(mockHomeMembers.filter((m) => m.home_id === id))
        setLoading(false)
        return
      }
      try {
        const [homeRes, alertsRes, shoppingRes, mealsRes, membersRes] =
          await Promise.all([
            supabase.from("homes").select("*").eq("id", id).single(),
            supabase
              .from("pantry_items")
              .select("*")
              .eq("home_id", id)
              .in("status", ["Critical", "Out of Stock"])
              .is("archived_at", null),
            supabase
              .from("shopping_items")
              .select("*, added_by_profile:profiles!added_by(id, display_name, email)")
              .eq("home_id", id)
              .eq("status", "Open")
              .is("archived_at", null),
            supabase
              .from("prepared_meals")
              .select("*")
              .eq("home_id", id)
              .is("archived_at", null)
              .order("expiry_date"),
            supabase
              .from("home_members")
              .select("*, profile:profiles(id, display_name, email)")
              .eq("home_id", id)
              .is("removed_at", null),
          ])

        if (!homeRes.data) {
          setNotFoundFlag(true)
          setLoading(false)
          return
        }

        setHome(homeRes.data)
        setAlerts((alertsRes.data as PantryItem[]) ?? [])
        setShopping((shoppingRes.data as ShoppingItem[]) ?? [])
        setMeals((mealsRes.data as PreparedMeal[]) ?? [])
        setMembers((membersRes.data as HomeMember[]) ?? [])
      } catch {
        setError("Failed to load residence. Check your connection and try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, retryCount])

  if (notFoundFlag) notFound()

  return (
    <AppShell>
      {/* BACK */}
      <Link
        href="/homes"
        className="mb-4 flex items-center gap-1.5 text-sm font-bold text-blue-600"
      >
        <ChevronLeft size={16} />
        All Homes
      </Link>

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      {loading || !home ? (
        <div className="space-y-4">
          <div className="h-48 animate-pulse rounded-[26px] bg-slate-200" />
          <div className="h-24 animate-pulse rounded-[22px] bg-slate-200" />
          <div className="h-24 animate-pulse rounded-[22px] bg-slate-200" />
        </div>
      ) : (
        <>
          {/* HOME HEADER */}
          <div className="mb-6 rounded-[26px] bg-gradient-to-br from-[#0F2A55] to-[#2563EB] p-6 text-white shadow-2xl shadow-blue-500/20">
            <h1 className="text-2xl font-extrabold">{home.name}</h1>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-blue-200">
              <MapPin size={13} />
              {home.location}
            </div>
            {home.notes && (
              <p className="mt-3 text-sm leading-relaxed text-blue-100">
                {home.notes}
              </p>
            )}

            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                { label: "Alerts", value: alerts.length },
                { label: "Shopping", value: shopping.length },
                { label: "Meals", value: meals.length },
                { label: "Staff", value: members.length },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl bg-white/15 p-2 text-center backdrop-blur-sm"
                >
                  <div className="text-xl font-extrabold">{value}</div>
                  <div className="mt-0.5 text-xs text-blue-200">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {home.kitchen_equipment && (
            <InfoBlock
              title="Kitchen Equipment"
              value={home.kitchen_equipment}
            />
          )}
          {home.preferences && (
            <InfoBlock
              title="Client Preferences"
              value={home.preferences}
            />
          )}

          {/* PANTRY ALERTS */}
          {alerts.length > 0 && (
            <Section
              title="Pantry Alerts"
              icon={<Package size={16} />}
              seeAllHref="/pantry"
            >
              {alerts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.storage_location} · {item.quantity} {item.unit}
                    </p>
                  </div>
                  <StatusBadge
                    label={item.status}
                    type={pantryStatusType(item.status)}
                  />
                </div>
              ))}
            </Section>
          )}

          {/* SHOPPING */}
          <Section
            title="Shopping List"
            icon={<ShoppingCart size={16} />}
            seeAllHref="/shopping-list"
          >
            {shopping.length === 0 ? (
              <p className="py-3 text-sm text-slate-400">Nothing open.</p>
            ) : (
              shopping.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.quantity_needed} · by{" "}
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
              ))
            )}
          </Section>

          {/* MEALS */}
          <Section
            title="Meals"
            icon={<UtensilsCrossed size={16} />}
            seeAllHref="/meals"
          >
            {meals.length === 0 ? (
              <p className="py-3 text-sm text-slate-400">No meals logged.</p>
            ) : (
              meals.map((meal) => (
                <div
                  key={meal.id}
                  className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {meal.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {meal.portions} portions · {meal.storage_location}
                    </p>
                  </div>
                  <StatusBadge
                    label={meal.status}
                    type={mealStatusType(meal.status)}
                  />
                </div>
              ))
            )}
          </Section>

          {/* TEAM */}
          <Section
            title="Team Access"
            icon={<Users size={16} />}
            seeAllHref="/settings/team"
          >
            {members.length === 0 ? (
              <p className="py-3 text-sm text-slate-400">No team members.</p>
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {m.profile?.display_name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {m.profile?.email}
                    </p>
                  </div>
                  <StatusBadge
                    label={m.role}
                    type={m.role === "admin" ? "blue" : "ok"}
                  />
                </div>
              ))
            )}
          </Section>
        </>
      )}
    </AppShell>
  )
}

function Section({
  title,
  icon,
  seeAllHref,
  children,
}: {
  title: string
  icon?: React.ReactNode
  seeAllHref?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-base font-extrabold text-slate-900">
          {icon}
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="inline-flex min-h-[44px] items-center text-xs font-bold text-blue-600"
          >
            See all
          </Link>
        )}
      </div>
      <div className="rounded-[22px] border border-[#E6EEF8] bg-white px-4 shadow-md shadow-slate-900/4">
        {children}
      </div>
    </div>
  )
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="mb-4 rounded-[18px] border border-[#E6EEF8] bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  )
}

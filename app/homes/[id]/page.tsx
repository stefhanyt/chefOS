"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import AppShell from "@/components/AppShell"
import MobileTopBar from "@/components/MobileTopBar"
import StatusBadge, { pantryStatusType, mealStatusType } from "@/components/StatusBadge"
import SheetModal from "@/components/SheetModal"
import FormField from "@/components/FormField"
import ModalSubmitFooter from "@/components/ModalSubmitFooter"
import { createClient } from "@/lib/supabase/client"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { useToast } from "@/components/ToastProvider"
import { CONFIG_ERROR } from "@/lib/constants"
import type {
  Home,
  PantryItem,
  ShoppingItem,
  PreparedMeal,
  HomeMember,
} from "@/lib/types"
import {
  MapPin,
  Users,
  Package,
  ShoppingCart,
  UtensilsCrossed,
  Pencil,
} from "lucide-react"
import ErrorBanner from "@/components/ErrorBanner"
import { SkeletonList } from "@/components/Skeleton"
import { ui } from "@/lib/ui"

export default function HomeDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const id = params?.id ?? ""
  const { showSuccess, showError } = useToast()

  const [home, setHome] = useState<Home | null>(null)
  const [showEdit, setShowEdit] = useState(false)
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
        setError(CONFIG_ERROR)
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
      } catch (err) {
        logSupabaseError("home detail load", err)
        setError("Failed to load residence. Check your connection and try again.")
        showError(getSupabaseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, retryCount])

  async function handleSaveHome(form: {
    name: string
    location: string
    notes: string
    kitchen_equipment: string
    preferences: string
  }) {
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const { data, error } = await supabase
      .from("homes")
      .update({
        name: form.name,
        location: form.location,
        notes: form.notes,
        kitchen_equipment: form.kitchen_equipment,
        preferences: form.preferences,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single()
    if (error) {
      logSupabaseError("home detail update", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    if (data) setHome(data as Home)
    setShowEdit(false)
    showSuccess("Residence updated")
  }

  if (notFoundFlag) notFound()

  return (
    <AppShell>
      <MobileTopBar backHref="/homes" backLabel="All Homes" />

      {error && (
        <ErrorBanner message={error} onRetry={() => setRetryCount((c) => c + 1)} />
      )}

      {loading || !home ? (
        <SkeletonList count={3} className="h-28" />
      ) : (
        <>
          {/* HOME HEADER */}
          <div className={`relative mb-7 ${ui.hero}`}>
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-ivory/20 bg-ivory/10 text-ivory"
              aria-label="Edit residence"
            >
              <Pencil size={16} />
            </button>
            <h1 className="pr-12 font-display text-2xl font-semibold">{home.name}</h1>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-ivory/70">
              <MapPin size={13} />
              {home.location}
            </div>
            {home.notes && (
              <p className="mt-3 text-sm leading-relaxed text-ivory/75">
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
                  className="rounded-xl border border-ivory/15 bg-ivory/10 p-2 text-center backdrop-blur-sm"
                >
                  <div className="font-display text-xl font-semibold">{value}</div>
                  <div className="mt-0.5 text-xs text-ivory/60">{label}</div>
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
                  className={`flex items-center justify-between ${ui.divider} py-3.5`}
                >
                  <div>
                    <p className="text-sm font-semibold text-charcoal">
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
                  className={`flex items-center justify-between ${ui.divider} py-3.5`}
                >
                  <div>
                    <p className="text-sm font-semibold text-charcoal">
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
                  className={`flex items-center justify-between ${ui.divider} py-3.5`}
                >
                  <div>
                    <p className="text-sm font-semibold text-charcoal">
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
                  className={`flex items-center justify-between ${ui.divider} py-3.5`}
                >
                  <div>
                    <p className="text-sm font-semibold text-charcoal">
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
          {showEdit && home && (
            <HomeEditModal home={home} onClose={() => setShowEdit(false)} onSave={handleSaveHome} />
          )}
        </>
      )}
    </AppShell>
  )
}

function HomeEditModal({
  home,
  onClose,
  onSave,
}: {
  home: Home
  onClose: () => void
  onSave: (form: {
    name: string
    location: string
    notes: string
    kitchen_equipment: string
    preferences: string
  }) => void | Promise<void>
}) {
  const formId = "home-detail-form"
  const [name, setName] = useState(home.name)
  const [location, setLocation] = useState(home.location)
  const [notes, setNotes] = useState(home.notes ?? "")
  const [kitchen, setKitchen] = useState(home.kitchen_equipment ?? "")
  const [preferences, setPreferences] = useState(home.preferences ?? "")
  const [saving, setSaving] = useState(false)

  const validation = useMemo(() => {
    const missing: string[] = []
    if (!name.trim()) missing.push("name")
    if (!location.trim()) missing.push("location")
    return { canSubmit: missing.length === 0 && !saving, missing }
  }, [name, location, saving])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validation.canSubmit) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        location: location.trim(),
        notes: notes.trim(),
        kitchen_equipment: kitchen.trim(),
        preferences: preferences.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetModal
      open
      onClose={onClose}
      title="Edit Residence"
      footer={
        <ModalSubmitFooter
          formId={formId}
          label="Save Changes"
          saving={saving}
          disabled={!validation.canSubmit}
          missing={validation.missing}
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" value={name} onChange={setName} required />
        <FormField label="Location" value={location} onChange={setLocation} required />
        <FormField label="Notes" value={notes} onChange={setNotes} />
        <FormField label="Kitchen Equipment" value={kitchen} onChange={setKitchen} />
        <FormField label="Client Preferences" value={preferences} onChange={setPreferences} />
      </form>
    </SheetModal>
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
        <h2 className={`flex items-center gap-1.5 ${ui.sectionTitle}`}>
          {icon}
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className={`inline-flex min-h-[44px] items-center ${ui.link}`}
          >
            See all
          </Link>
        )}
      </div>
      <div className={`${ui.cardInset} px-4`}>
        {children}
      </div>
    </div>
  )
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className={`${ui.card} mb-4 p-4`}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
        {title}
      </p>
      <p className="text-sm leading-relaxed text-stone-600">{value}</p>
    </div>
  )
}

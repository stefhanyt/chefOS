"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import MobileTopBar from "@/components/MobileTopBar"
import { Check, Loader2, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { useToast } from "@/components/ToastProvider"
import type { Home } from "@/lib/types"

const CATEGORIES = [
  "Dairy & Eggs", "Proteins", "Vegetables", "Fruits",
  "Grains & Pasta", "Oils & Condiments", "Beverages",
  "Frozen", "Pantry Staples", "Other",
]

interface DetectedItem {
  name: string
  quantity: number
  unit: string
  category: string
  notes: string
  destination: string
  home_id: string
  storage_location: string
  minimum_quantity: string
}

type Step = "upload" | "analyzing" | "review" | "detail" | "saved"

export default function PhotoScanPage() {
  const { showSuccess, showError } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>("upload")
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMediaType, setImageMediaType] = useState<string>("image/jpeg")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [items, setItems] = useState<DetectedItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [confirmed, setConfirmed] = useState<DetectedItem[]>([])
  const [homes, setHomes] = useState<Home[]>([])
  const [error, setError] = useState("")

  const current = items[currentIndex]

  useEffect(() => {
    loadHomes()
  }, [])

  async function loadHomes() {
    const supabase = createClient()
    if (!supabase) return
    const { data, error: dbError } = await supabase
      .from("homes")
      .select("id, name")
      .is("archived_at", null)
      .order("name")
    if (dbError) {
      logSupabaseError("photo scan homes", dbError)
      showError(getSupabaseErrorMessage(dbError))
      return
    }
    setHomes((data as Home[]) ?? [])
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const mediaType = (file.type || "image/jpeg") as string
    setImageMediaType(mediaType)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setImageBase64(result.split(",")[1])
      setImagePreview(result)
    }
    reader.readAsDataURL(file)
  }

  async function analyze() {
    if (!imageBase64) return
    setStep("analyzing")
    setError("")
    try {
      const res = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64, mediaType: imageMediaType }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 503) {
          setError("AI analysis not configured. Add ANTHROPIC_API_KEY to your environment.")
        } else {
          setError(body.error ?? "Analysis failed. Try again.")
        }
        setStep("upload")
        return
      }

      const data = await res.json()
      const parsed: any[] = Array.isArray(data.items) ? data.items : []

      if (parsed.length === 0) {
        setError("No food items detected. Try a clearer photo with visible labels.")
        setStep("upload")
        return
      }

      const mapped: DetectedItem[] = parsed.map((p) => ({
        name: p.name ?? "",
        quantity: p.quantity ?? 1,
        unit: p.unit ?? "piece",
        category: p.category ?? "Other",
        notes: p.notes ?? "",
        destination: "",
        home_id: homes[0]?.id ?? "",
        storage_location: "",
        minimum_quantity: "",
      }))
      setItems(mapped)
      setCurrentIndex(0)
      setConfirmed([])
      setStep("review")
    } catch {
      setError("Analysis failed. Check your connection and try again.")
      setStep("upload")
    }
  }

  function updateCurrent(field: keyof DetectedItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === currentIndex ? { ...item, [field]: value } : item))
    )
  }

  async function saveAndNext() {
    const item = current
    if (!item?.name.trim() || !item.home_id) {
      showError("Item name and residence are required.")
      return
    }
    const supabase = createClient()
    if (!supabase) {
      showError("Database not configured.")
      return
    }
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in.")
      return
    }

    if (item.destination === "Pantry") {
      const { error: pantryError } = await supabase.from("pantry_items").insert({
        name: item.name.trim(),
        quantity: item.quantity,
        unit: item.unit.trim(),
        category: item.category,
        storage_location: item.storage_location.trim(),
        minimum_quantity: Number(item.minimum_quantity) || 0,
        status: "OK",
        home_id: item.home_id,
        created_by: userId,
      })
      if (pantryError) {
        logSupabaseError("photo pantry insert", pantryError)
        showError(getSupabaseErrorMessage(pantryError))
        return
      }
    } else if (item.destination === "Shopping List") {
      const { error: shopError } = await supabase.from("shopping_items").insert({
        name: item.name.trim(),
        quantity_needed: `${item.quantity} ${item.unit}`.trim(),
        category: item.category,
        priority: "Normal",
        status: "Open",
        home_id: item.home_id,
        added_by: userId,
      })
      if (shopError) {
        logSupabaseError("photo shopping insert", shopError)
        showError(getSupabaseErrorMessage(shopError))
        return
      }
    }

    await supabase.from("barcode_scans").insert({
      home_id: item.home_id,
      user_id: userId,
      product_name: item.name.trim(),
      quantity: item.quantity,
      unit: item.unit.trim(),
      storage_location: item.storage_location.trim(),
      scan_mode: "photo",
    })

    setConfirmed((prev) => [...prev, item])
    const next = currentIndex + 1
    if (next >= items.length) {
      setStep("saved")
      return
    }
    setCurrentIndex(next)
  }

  function skipAndNext() {
    const next = currentIndex + 1
    if (next >= items.length) {
      setStep("saved")
      return
    }
    setCurrentIndex(next)
  }

  function reset() {
    setStep("upload")
    setImageBase64(null)
    setImagePreview(null)
    setItems([])
    setCurrentIndex(0)
    setConfirmed([])
    setError("")
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <AppShell>
      <MobileTopBar backHref="/dashboard" title="Photo Scan" />

      <div className="mb-6">
        <p className="text-sm text-slate-500">
          {step === "upload" && "Photograph your groceries — AI identifies every item"}
          {step === "analyzing" && "Identifying products from your photo…"}
          {step === "review" && `${items.length} items found — confirm each one`}
          {step === "detail" && `Item ${currentIndex + 1} of ${items.length}`}
          {step === "saved" && `${confirmed.length} items saved`}
        </p>
      </div>

      {/* UPLOAD STEP */}
      {step === "upload" && (
        <>
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div
            onClick={() => fileRef.current?.click()}
            className="mb-4 flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-blue-200 bg-blue-50 p-8 text-center"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="preview" className="w-full rounded-2xl" />
            ) : (
              <>
                <p className="text-base font-semibold text-navy-light">Take or Upload Photo</p>
                <p className="text-sm leading-relaxed text-slate-500">
                  Shelf, delivery bag, counter — AI identifies every visible item
                </p>
              </>
            )}
          </div>
          {/* No capture attribute — lets user choose camera or library */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          {imagePreview ? (
            <button
              onClick={analyze}
              className="flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-navy text-sm font-semibold text-white shadow-soft"
            >
              Analyze Photo
            </button>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-600"
            >
              Choose from Library
            </button>
          )}
        </>
      )}

      {/* ANALYZING STEP */}
      {step === "analyzing" && (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 size={36} className="animate-spin text-navy-light" />
          <p className="text-sm text-slate-500">Reading labels and classifying items…</p>
        </div>
      )}

      {/* REVIEW STEP */}
      {step === "review" && (
        <>
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
            {items.length} items identified — confirm each one below
          </div>
          {items.map((item, i) => (
            <div
              key={i}
              className="mb-2 flex items-center gap-3 rounded-2xl border border-stone-200/60 bg-white px-4 py-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{item.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {item.quantity} {item.unit} · {item.category}
                </p>
              </div>
            </div>
          ))}
          <button
            onClick={() => { setCurrentIndex(0); setStep("detail") }}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-navy text-sm font-semibold text-white shadow-soft"
          >
            Start Confirming
          </button>
          <button
            onClick={reset}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-500"
          >
            Retake Photo
          </button>
        </>
      )}

      {/* DETAIL STEP */}
      {step === "detail" && current && (
        <>
          <div className="mb-4">
            <div className="mb-2 flex justify-between text-xs font-bold">
              <span className="text-slate-500">Item {currentIndex + 1} of {items.length}</span>
              <span className="text-navy-light">{confirmed.length} saved</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-navy transition-all"
                style={{ width: `${(currentIndex / items.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="mb-4 rounded-2xl bg-navy p-4 text-white">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider opacity-50">Detected</p>
            <p className="text-lg font-semibold">{current.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
                {current.quantity} {current.unit}
              </span>
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
                {current.category}
              </span>
            </div>
          </div>

          <div className="mb-4 space-y-4 rounded-[20px] border border-stone-200/60 bg-white p-4">
            <Field label="Product Name">
              <input
                value={current.name}
                onChange={(e) => updateCurrent("name", e.target.value)}
                className="w-full rounded-xl border border-stone-200/60 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity">
                <input
                  type="number"
                  inputMode="decimal"
                  value={current.quantity}
                  onChange={(e) => updateCurrent("quantity", Number(e.target.value))}
                  className="w-full rounded-xl border border-stone-200/60 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </Field>
              <Field label="Unit">
                <input
                  value={current.unit}
                  onChange={(e) => updateCurrent("unit", e.target.value)}
                  className="w-full rounded-xl border border-stone-200/60 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </Field>
            </div>
            <Field label="Category">
              <select
                value={current.category}
                onChange={(e) => updateCurrent("category", e.target.value)}
                className="w-full rounded-xl border border-stone-200/60 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 focus:outline-none"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Destination">
              <div className="flex gap-2">
                {(["Shopping List", "Pantry"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => updateCurrent("destination", d)}
                    className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      current.destination === d
                        ? d === "Shopping List"
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-green-300 bg-green-100 text-green-700"
                        : "border-stone-200/60 bg-white text-slate-500"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
            {homes.length > 1 && (
              <Field label="Residence">
                <div className="space-y-2">
                  {homes.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => updateCurrent("home_id", h.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                        current.home_id === h.id
                          ? "border-2 border-blue-600 bg-blue-50 text-blue-700"
                          : "border-stone-200/60 bg-white text-slate-600"
                      }`}
                    >
                      {h.name}
                      {current.home_id === h.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Storage Location">
              <input
                value={current.storage_location}
                onChange={(e) => updateCurrent("storage_location", e.target.value)}
                placeholder="e.g. Main Fridge, Freezer, Pantry shelf"
                className="w-full rounded-xl border border-stone-200/60 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </Field>
            {current.destination === "Pantry" && (
              <Field label="Minimum Quantity (for alerts)">
                <input
                  type="number"
                  inputMode="decimal"
                  value={current.minimum_quantity}
                  onChange={(e) => updateCurrent("minimum_quantity", e.target.value)}
                  placeholder="e.g. 2"
                  className="w-full rounded-xl border border-stone-200/60 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </Field>
            )}
          </div>

          <button
            onClick={saveAndNext}
            disabled={!current.destination}
            className="flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-navy text-sm font-semibold text-white shadow-soft disabled:opacity-50"
          >
            Save & Next
          </button>
          <button
            onClick={skipAndNext}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-500"
          >
            Skip this item
          </button>
        </>
      )}

      {/* SAVED STEP */}
      {step === "saved" && (
        <>
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check size={28} className="text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">
              {confirmed.length} items saved
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {confirmed.filter((i) => i.destination === "Shopping List").length} to Shopping List ·{" "}
              {confirmed.filter((i) => i.destination === "Pantry").length} to Pantry
            </p>
          </div>

          {homes.map((h) => {
            const homeItems = confirmed.filter((i) => i.home_id === h.id)
            if (!homeItems.length) return null
            return (
              <div key={h.id} className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {h.name}
                </p>
                <div className="rounded-[20px] border border-stone-200/60 bg-white px-4 shadow-sm">
                  {homeItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {item.quantity} {item.unit} · {item.storage_location || "—"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          item.destination === "Shopping List"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {item.destination === "Shopping List" ? "Shopping" : "Pantry"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <button
            onClick={reset}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-navy text-sm font-semibold text-white shadow-soft"
          >
            Scan Another Photo
          </button>
        </>
      )}
    </AppShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      {children}
    </div>
  )
}

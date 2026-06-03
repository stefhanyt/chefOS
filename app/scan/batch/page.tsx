"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import MobileTopBar from "@/components/MobileTopBar"
import ScanSourceBanner from "@/components/ScanSourceBanner"
import ScanProductFields from "@/components/ScanProductFields"
import ScanStickyFooter from "@/components/ScanStickyFooter"
import { normalizeScanQuantityDisplay, parseScanQuantityForSave } from "@/lib/scan-form-options"
import { Trash2, Check, Loader2, ScanLine, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import {
  resolveBarcodeProduct,
  upsertProductCatalog,
  type ProductLookupSource,
} from "@/lib/scan-product"
import { useToast } from "@/components/ToastProvider"
import { CONFIG_ERROR } from "@/lib/constants"
import { useBarcodeScanner } from "@/lib/use-barcode-scanner"
import type { Home } from "@/lib/types"

interface ScannedItem {
  id: string
  barcode: string
  productName: string
  brand: string
  quantity: string
  unit: string
  category: string
  location: string
  lookupSource: ProductLookupSource
  looking_up: boolean
}

export default function BatchScanPage() {
  const { showSuccess, showError } = useToast()
  const { videoRef, start: startCamera, release: releaseCamera } = useBarcodeScanner()
  const scannedCodes = useRef<Set<string>>(new Set())

  const [items, setItems] = useState<ScannedItem[]>([])
  const [homes, setHomes] = useState<Home[]>([])
  const [homeId, setHomeId] = useState("")
  const [scanning, setScanning] = useState(true)
  const [saved, setSaved] = useState(false)
  const [errorKind, setErrorKind] = useState<"none" | "permission" | "camera">("none")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    loadHomes()
  }, [])

  const handleScannerError = useCallback((e: unknown) => {
    const err = e as { name?: string; message?: string }
    if (err?.name === "NotAllowedError" || err?.message?.toLowerCase().includes("permission")) {
      setErrorKind("permission")
      setErrorMsg("Camera access denied. On iPhone: Settings → Safari → Camera → Allow.")
    } else {
      setErrorKind("camera")
      setErrorMsg("Camera unavailable.")
    }
    setScanning(false)
  }, [])

  async function loadHomes() {
    const supabase = createClient()
    if (!supabase) return
    const { data, error } = await supabase
      .from("homes")
      .select("id, name")
      .is("archived_at", null)
      .order("name")
    if (error) {
      logSupabaseError("batch scan homes", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    const list = (data as Home[]) ?? []
    setHomes(list)
    setHomeId(list[0]?.id ?? "")
  }

  function stopScanner() {
    setScanning(false)
  }

  function beginScanning() {
    setErrorKind("none")
    setErrorMsg("")
    setScanning(true)
  }

  async function addItem(code: string) {
    const tempId = `item-${Date.now()}-${Math.random()}`
    setItems((prev) => [
      ...prev,
      {
        id: tempId,
        barcode: code,
        productName: "",
        brand: "",
        quantity: "1",
        unit: "",
        category: "Other",
        location: "",
        lookupSource: "manual",
        looking_up: true,
      },
    ])

    const supabase = createClient()
    if (!supabase) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === tempId ? { ...i, looking_up: false, lookupSource: "manual" } : i,
        ),
      )
      return
    }

    const userId = await getAuthUserId(supabase)
    if (!userId) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === tempId ? { ...i, looking_up: false, lookupSource: "manual" } : i,
        ),
      )
      return
    }

    const result = await resolveBarcodeProduct(supabase, code, userId)
    setItems((prev) =>
      prev.map((i) =>
        i.id === tempId
          ? {
              ...i,
              productName: result.fields.productName,
              brand: result.fields.brand,
              quantity: normalizeScanQuantityDisplay(result.fields.quantity),
              unit: result.fields.unit,
              category: result.fields.category,
              lookupSource: result.source,
              looking_up: false,
            }
          : i,
      ),
    )
  }

  function updateItem(id: string, field: keyof ScannedItem, value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  function removeItem(id: string) {
    const item = items.find((i) => i.id === id)
    if (item) scannedCodes.current.delete(item.barcode)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  useEffect(() => {
    if (!scanning || saved) {
      releaseCamera()
      return
    }

    startCamera({
      continuous: true,
      onDetected: async (code) => {
        if (!scannedCodes.current.has(code)) {
          scannedCodes.current.add(code)
          await addItem(code)
        }
      },
      onError: handleScannerError,
    })

    return () => releaseCamera()
  }, [scanning, saved, startCamera, releaseCamera, handleScannerError])

  async function handleAddAll() {
    stopScanner()
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    if (!homeId) {
      showError("Select a residence before saving.")
      return
    }
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in.")
      return
    }

    const valid = items.filter((i) => i.productName.trim())
    if (valid.length === 0) {
      showError("No items with product names to save.")
      return
    }

    const rows = valid.map((i) => ({
      name: i.productName.trim(),
      quantity: parseScanQuantityForSave(i.quantity),
      unit: i.unit.trim(),
      storage_location: i.location.trim(),
      category: i.category.trim() || "Other",
      minimum_quantity: 0,
      status: "OK",
      home_id: homeId,
      barcode: i.barcode || null,
      created_by: userId,
    }))

    const { error: pantryError } = await supabase.from("pantry_items").insert(rows)
    if (pantryError) {
      logSupabaseError("batch pantry insert", pantryError)
      showError(getSupabaseErrorMessage(pantryError))
      return
    }

    for (const item of valid) {
      if (!item.barcode.trim()) continue
      await upsertProductCatalog(supabase, userId, {
        barcode: item.barcode,
        productName: item.productName,
        brand: item.brand,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        notes: "",
      })
    }

    await supabase.from("barcode_scans").insert(
      valid.map((i) => ({
        home_id: homeId,
        user_id: userId,
        barcode: i.barcode,
        product_name: i.productName.trim(),
        quantity: parseScanQuantityForSave(i.quantity),
        unit: i.unit.trim(),
        storage_location: i.location.trim(),
        scan_mode: "batch" as const,
      })),
    )

    setScanning(false)
    setSaved(true)
    showSuccess(`${valid.length} items saved to pantry`)
  }

  if (saved) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">{items.length} items added!</h2>
          <p className="text-center text-sm text-slate-500">
            All scanned items have been saved to your pantry.
          </p>
          <div className="mt-4 flex w-full gap-3">
            <Link href="/pantry" className="flex-1">
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-600"
              >
                View Pantry
              </button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-navy text-sm font-semibold text-white shadow-lg shadow-blue-600/30"
              >
                Dashboard
              </button>
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <MobileTopBar
        backHref="/dashboard"
        onBeforeBack={releaseCamera}
        title="Batch Scan"
        trailing={
          <span className="mobile-header-button inline-flex items-center justify-center rounded-full bg-blue-100 px-3 text-xs font-semibold text-blue-700">
            {items.length}
          </span>
        }
      />

      {errorKind !== "none" && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${
            errorKind === "permission" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"
          }`}
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {homes.length > 1 && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Residence
          </label>
          <select
            value={homeId}
            onChange={(e) => setHomeId(e.target.value)}
            className="w-full rounded-2xl border border-stone-200/60 bg-slate-50 px-4 py-3 text-base"
          >
            {homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {scanning && (
        <div className="relative mb-4 overflow-hidden rounded-[26px] bg-slate-900 shadow-2xl">
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            autoPlay
            muted
            playsInline
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-48 rounded-lg border-2 border-blue-400 opacity-70" />
          </div>
          <button
            type="button"
            onClick={stopScanner}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
            aria-label="Done scanning"
          >
            <Check size={18} />
          </button>
        </div>
      )}

      {!scanning && items.length === 0 && (
        <div className="mb-4 rounded-[22px] border border-stone-200/60 bg-white p-8 text-center text-sm text-slate-400">
          No items scanned yet.
          <button
            type="button"
            onClick={beginScanning}
            className="mx-auto mt-3 flex min-h-[44px] items-center gap-2 font-bold text-navy-light"
          >
            <ScanLine size={15} />
            Start Scanning
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="scan-form-scroll-pad mb-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Review Items
          </h2>
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-[22px] border border-stone-200/60 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400">{item.barcode}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="flex h-11 w-11 items-center justify-center text-red-400"
                  aria-label="Remove item"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {item.looking_up ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                  Looking up product…
                </div>
              ) : (
                <div className="space-y-3">
                  <ScanSourceBanner source={item.lookupSource} />
                  <ScanProductFields
                    variant="compact"
                    values={{
                      productName: item.productName,
                      brand: item.brand,
                      quantity: item.quantity,
                      unit: item.unit,
                      category: item.category,
                    }}
                    onChange={(patch) => {
                      if (patch.productName !== undefined)
                        updateItem(item.id, "productName", patch.productName)
                      if (patch.brand !== undefined)
                        updateItem(item.id, "brand", patch.brand)
                      if (patch.quantity !== undefined)
                        updateItem(item.id, "quantity", patch.quantity)
                      if (patch.unit !== undefined)
                        updateItem(item.id, "unit", patch.unit)
                      if (patch.category !== undefined)
                        updateItem(item.id, "category", patch.category)
                    }}
                  />
                  <input
                    type="text"
                    value={item.location}
                    onChange={(e) => updateItem(item.id, "location", e.target.value)}
                    placeholder="Storage location (e.g. Fridge)"
                    className="w-full rounded-xl border border-stone-200/60 bg-slate-50 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <ScanStickyFooter>
          {!scanning && (
            <button
              type="button"
              onClick={beginScanning}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-600"
            >
              <ScanLine size={16} />
              Scan More
            </button>
          )}
          <button
            type="button"
            onClick={handleAddAll}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-navy text-sm font-semibold text-white shadow-soft"
          >
            <Check size={16} />
            Add All to Pantry ({items.length})
          </button>
        </ScanStickyFooter>
      )}
    </AppShell>
  )
}

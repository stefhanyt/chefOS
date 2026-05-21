"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import { ChevronLeft, Trash2, Check, Loader2, ScanLine, AlertCircle } from "lucide-react"
import { lookupBarcode, parseProductName } from "@/lib/openfoodfacts"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { useToast } from "@/components/ToastProvider"
import type { Home } from "@/lib/types"

interface ScannedItem {
  id: string
  barcode: string
  productName: string
  quantity: string
  unit: string
  location: string
  looking_up: boolean
}

export default function BatchScanPage() {
  const { showSuccess, showError } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
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
    startScanner()
    return () => stopScanner()
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

  async function startScanner() {
    setScanning(true)
    setErrorKind("none")
    setErrorMsg("")
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser")
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      const constraints: MediaStreamConstraints = {
        video: { facingMode: { ideal: "environment" } },
      }

      if (videoRef.current) {
        reader.decodeFromConstraints(constraints, videoRef.current, async (result) => {
          if (result) {
            const code = result.getText()
            if (!scannedCodes.current.has(code)) {
              scannedCodes.current.add(code)
              await addItem(code)
            }
          }
        })
      }
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.message?.toLowerCase().includes("permission")) {
        setErrorKind("permission")
        setErrorMsg("Camera access denied. On iPhone: Settings → Safari → Camera → Allow.")
      } else {
        setErrorKind("camera")
        setErrorMsg("Camera unavailable.")
      }
      setScanning(false)
    }
  }

  function stopScanner() {
    try { readerRef.current?.reset() } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()) } catch {}
    setScanning(false)
  }

  async function addItem(code: string) {
    const tempId = `item-${Date.now()}-${Math.random()}`
    setItems((prev) => [
      ...prev,
      { id: tempId, barcode: code, productName: "", quantity: "", unit: "", location: "", looking_up: true },
    ])
    const product = await lookupBarcode(code)
    const name = product ? parseProductName(product) : ""
    setItems((prev) =>
      prev.map((i) => (i.id === tempId ? { ...i, productName: name, looking_up: false } : i))
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

  async function handleAddAll() {
    const supabase = createClient()
    if (!supabase || !homeId) {
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
      quantity: Number(i.quantity) || 0,
      unit: i.unit.trim(),
      storage_location: i.location.trim(),
      category: "Other",
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

    await supabase.from("barcode_scans").insert(
      valid.map((i) => ({
        home_id: homeId,
        user_id: userId,
        barcode: i.barcode,
        product_name: i.productName.trim(),
        quantity: Number(i.quantity) || 0,
        unit: i.unit.trim(),
        storage_location: i.location.trim(),
        scan_mode: "batch" as const,
      })),
    )

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
          <h2 className="text-xl font-extrabold text-slate-900">{items.length} items added!</h2>
          <p className="text-center text-sm text-slate-500">
            All scanned items have been saved to your pantry.
          </p>
          <div className="mt-4 flex w-full gap-3">
            <Link href="/pantry" className="flex-1">
              <button className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-[#E6EEF8] bg-white text-sm font-bold text-slate-600">
                View Pantry
              </button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <button className="flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-blue-600 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30">
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
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-blue-600"
        >
          <ChevronLeft size={16} />
          Back
        </Link>
        <h1 className="text-xl font-extrabold text-slate-900">Batch Scan</h1>
        <span className="ml-auto rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-700">
          {items.length} scanned
        </span>
      </div>

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
            onClick={stopScanner}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <Check size={18} />
          </button>
        </div>
      )}

      {!scanning && items.length === 0 && (
        <div className="mb-4 rounded-[22px] border border-[#E6EEF8] bg-white p-8 text-center text-sm text-slate-400">
          No items scanned yet.
          <button
            onClick={startScanner}
            className="mx-auto mt-3 flex min-h-[44px] items-center gap-2 font-bold text-blue-600"
          >
            <ScanLine size={15} />
            Start Scanning
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-4 space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Review Items
          </h2>
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-[22px] border border-[#E6EEF8] bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400">{item.barcode}</span>
                <button
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
                  <input
                    type="text"
                    value={item.productName}
                    onChange={(e) => updateItem(item.id, "productName", e.target.value)}
                    placeholder="Product name"
                    className="w-full rounded-xl border border-[#E6EEF8] bg-slate-50 px-3 py-2 text-base font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                      placeholder="Qty"
                      className="rounded-xl border border-[#E6EEF8] bg-slate-50 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                      placeholder="Unit"
                      className="rounded-xl border border-[#E6EEF8] bg-slate-50 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <input
                    type="text"
                    value={item.location}
                    onChange={(e) => updateItem(item.id, "location", e.target.value)}
                    placeholder="Storage location (e.g. Fridge)"
                    className="w-full rounded-xl border border-[#E6EEF8] bg-slate-50 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {!scanning && (
          <button
            onClick={startScanner}
            className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-[#E6EEF8] bg-white px-5 text-sm font-bold text-slate-600 shadow-sm"
          >
            <ScanLine size={16} />
            Scan More
          </button>
        )}
        {items.length > 0 && (
          <button
            onClick={handleAddAll}
            className="flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30"
          >
            <Check size={16} />
            Add All to Pantry ({items.length})
          </button>
        )}
      </div>
    </AppShell>
  )
}

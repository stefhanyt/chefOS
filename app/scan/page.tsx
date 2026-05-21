"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import { ChevronLeft, Check, Loader2, AlertCircle, Image } from "lucide-react"
import { lookupBarcode, parseProductName } from "@/lib/openfoodfacts"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import { useToast } from "@/components/ToastProvider"
import type { Home } from "@/lib/types"

type ScanState = "scanning" | "looking_up" | "found" | "manual" | "saved"
type ErrorKind = "none" | "permission" | "camera" | "lookup"

export default function ScanPage() {
  const { showSuccess, showError } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const didScanRef = useRef(false)
  const readerRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [scanState, setScanState] = useState<ScanState>("scanning")
  const [barcode, setBarcode] = useState("")
  const [productName, setProductName] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unit, setUnit] = useState("")
  const [location, setLocation] = useState("")
  const [homeId, setHomeId] = useState("")
  const [homes, setHomes] = useState<Home[]>([])
  const [errorKind, setErrorKind] = useState<ErrorKind>("none")
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
      logSupabaseError("scan homes load", error)
      showError(getSupabaseErrorMessage(error))
      return
    }
    const list = (data as Home[]) ?? []
    setHomes(list)
    setHomeId(list[0]?.id ?? "")
  }

  async function startScanner() {
    didScanRef.current = false
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser")
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      const constraints: MediaStreamConstraints = {
        video: { facingMode: { ideal: "environment" } },
      }

      if (videoRef.current) {
        reader.decodeFromConstraints(constraints, videoRef.current, async (result, err) => {
          if (result && !didScanRef.current) {
            didScanRef.current = true
            const code = result.getText()
            setBarcode(code)
            stopScanner()
            await handleBarcode(code)
          }
        })
      }
    } catch (e: any) {
      if (
        e?.name === "NotAllowedError" ||
        e?.message?.toLowerCase().includes("permission")
      ) {
        setErrorKind("permission")
        setErrorMsg(
          "Camera access was denied. On iPhone: Settings → Safari → Camera → Allow."
        )
      } else {
        setErrorKind("camera")
        setErrorMsg("Camera unavailable. You can enter a barcode manually below.")
      }
      setScanState("manual")
    }
  }

  function stopScanner() {
    try {
      readerRef.current?.reset()
    } catch {}
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    } catch {}
  }

  async function handleBarcode(code: string) {
    setScanState("looking_up")
    const product = await lookupBarcode(code)
    if (product) {
      setProductName(parseProductName(product))
      setScanState("found")
    } else {
      setScanState("manual")
    }
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanState("looking_up")
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser")
      const reader = new BrowserMultiFormatReader()
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.src = url
      await new Promise<void>((res) => { img.onload = () => res() })
      const result = await reader.decodeFromImageElement(img)
      URL.revokeObjectURL(url)
      const code = result.getText()
      setBarcode(code)
      await handleBarcode(code)
    } catch {
      setBarcode("")
      setScanState("manual")
    }
  }

  async function handleSave() {
    if (!productName.trim() || !homeId) {
      showError("Product name and residence are required.")
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

    const { error: pantryError } = await supabase.from("pantry_items").insert({
      name: productName.trim(),
      quantity: Number(quantity) || 0,
      unit: unit.trim(),
      storage_location: location.trim(),
      category: "Other",
      minimum_quantity: 0,
      status: "OK",
      home_id: homeId,
      barcode: barcode || null,
      created_by: userId,
    })

    if (pantryError) {
      logSupabaseError("scan pantry insert", pantryError)
      showError(getSupabaseErrorMessage(pantryError))
      return
    }

    await supabase.from("barcode_scans").insert({
      home_id: homeId,
      user_id: userId,
      barcode: barcode || null,
      product_name: productName.trim(),
      quantity: Number(quantity) || 0,
      unit: unit.trim(),
      storage_location: location.trim(),
      scan_mode: "single",
    })

    setScanState("saved")
    showSuccess("Item saved to pantry")
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-navy-light"
        >
          <ChevronLeft size={16} />
          Back
        </Link>
        <h1 className="font-display text-xl font-semibold text-charcoal">Scan item</h1>
        <Link
          href="/scan/history"
          className="ml-auto text-xs font-bold text-navy-light"
        >
          History
        </Link>
      </div>

      {errorKind !== "none" && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${
            errorKind === "permission"
              ? "bg-amber-50 text-amber-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {scanState === "scanning" && (
        <>
          <div className="relative overflow-hidden rounded-[26px] bg-slate-900 shadow-2xl">
            <video
              ref={videoRef}
              className="aspect-square w-full object-cover"
              autoPlay
              muted
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-52 w-52">
                {(["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"] as const).map(
                  (pos, i) => (
                    <div
                      key={i}
                      className={`absolute ${pos} h-8 w-8 rounded-sm border-4 border-blue-400`}
                      style={{
                        borderRight: pos.includes("right") ? undefined : "none",
                        borderLeft: pos.includes("left") ? undefined : "none",
                        borderBottom: pos.includes("bottom") ? undefined : "none",
                        borderTop: pos.includes("top") ? undefined : "none",
                      }}
                    />
                  )
                )}
                <div className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-blue-400 opacity-70" />
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">
            Point camera at a barcode
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFile}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-600"
          >
            <Image size={15} />
            Use Photo Library
          </button>
          <button
            onClick={() => { stopScanner(); setScanState("manual") }}
            className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-600"
          >
            Enter Manually
          </button>
        </>
      )}

      {scanState === "looking_up" && (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 size={36} className="animate-spin text-navy-light" />
          <p className="text-sm text-slate-500">
            {barcode ? `Looking up barcode ${barcode}…` : "Processing image…"}
          </p>
        </div>
      )}

      {(scanState === "found" || scanState === "manual") && (
        <div className="space-y-4">
          {scanState === "found" && (
            <div className="flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              <Check size={15} />
              Product found · Barcode: {barcode}
            </div>
          )}

          <Field
            label="Product Name"
            value={productName}
            onChange={setProductName}
            placeholder="e.g. Organic Eggs"
          />

          {scanState === "manual" && (
            <Field
              label="Barcode (optional)"
              value={barcode}
              onChange={setBarcode}
              placeholder="Enter barcode number"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Quantity"
              value={quantity}
              onChange={setQuantity}
              placeholder="0"
              type="number"
            />
            <Field label="Unit" value={unit} onChange={setUnit} placeholder="e.g. dozen" />
          </div>

          {homes.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Residence
              </label>
              <select
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                className="w-full rounded-2xl border border-stone-200/60 bg-slate-50 px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-gold/15"
              >
                {homes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Field
            label="Storage Location"
            value={location}
            onChange={setLocation}
            placeholder="e.g. Fridge"
          />

          <button
            onClick={handleSave}
            disabled={!productName.trim()}
            className="flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-navy text-sm font-semibold text-white shadow-soft disabled:opacity-50"
          >
            Save to Pantry
          </button>

          <button
            onClick={() => { setScanState("scanning"); setErrorKind("none"); setErrorMsg(""); startScanner() }}
            className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-600"
          >
            Scan Another
          </button>
        </div>
      )}

      {scanState === "saved" && (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Saved!</h2>
          <p className="text-sm text-slate-500">{productName} added to pantry.</p>
          <div className="mt-4 flex w-full gap-3">
            <Link href="/pantry" className="flex-1">
              <button className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-600">
                View Pantry
              </button>
            </Link>
            <button
              onClick={() => {
                setScanState("scanning")
                setProductName("")
                setBarcode("")
                setQuantity("")
                setUnit("")
                setLocation("")
                setErrorKind("none")
                setErrorMsg("")
                startScanner()
              }}
              className="flex flex-1 min-h-[44px] items-center justify-center rounded-2xl bg-navy text-sm font-semibold text-white shadow-soft"
            >
              Scan Again
            </button>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-stone-200/60 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/15"
      />
    </div>
  )
}

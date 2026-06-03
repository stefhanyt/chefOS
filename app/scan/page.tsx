"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import MobileTopBar from "@/components/MobileTopBar"
import ScanSourceBanner from "@/components/ScanSourceBanner"
import ScanProductFields from "@/components/ScanProductFields"
import ScanStickyFooter from "@/components/ScanStickyFooter"
import { parseScanQuantityForSave } from "@/lib/scan-form-options"
import { Check, Loader2, AlertCircle, Image } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getAuthUserId } from "@/lib/supabase/auth-helpers"
import { getSupabaseErrorMessage, logSupabaseError } from "@/lib/supabase/errors"
import {
  applyFieldsToScanForm,
  resolveBarcodeProduct,
  upsertProductCatalog,
  type ProductLookupSource,
} from "@/lib/scan-product"
import { useToast } from "@/components/ToastProvider"
import { CONFIG_ERROR } from "@/lib/constants"
import type { Home } from "@/lib/types"

type ScanState = "scanning" | "looking_up" | "review" | "saved"
type ErrorKind = "none" | "permission" | "camera" | "lookup"

export default function ScanPage() {
  const { showSuccess, showError } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const didScanRef = useRef(false)
  const readerRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [scanState, setScanState] = useState<ScanState>("scanning")
  const [lookupSource, setLookupSource] = useState<ProductLookupSource>("manual")
  const [barcode, setBarcode] = useState("")
  const [productName, setProductName] = useState("")
  const [brand, setBrand] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unit, setUnit] = useState("")
  const [category, setCategory] = useState("Other")
  const [notes, setNotes] = useState("")
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
        reader.decodeFromConstraints(constraints, videoRef.current, async (result) => {
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
          "Camera access was denied. On iPhone: Settings → Safari → Camera → Allow.",
        )
      } else {
        setErrorKind("camera")
        setErrorMsg("Camera unavailable. You can enter a barcode manually below.")
      }
      setLookupSource("manual")
      setScanState("review")
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
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      setLookupSource("manual")
      setBarcode(code)
      setScanState("review")
      return
    }

    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in to look up products.")
      setLookupSource("manual")
      setBarcode(code)
      setScanState("review")
      return
    }

    try {
      const result = await resolveBarcodeProduct(supabase, code, userId)
      setLookupSource(result.source)
      setBarcode(result.barcode)
      applyFieldsToScanForm(result.fields, {
        setProductName,
        setBrand,
        setQuantity,
        setUnit,
        setCategory,
        setNotes,
      })
      setScanState("review")
    } catch (err) {
      logSupabaseError("scan product resolve", err)
      setErrorKind("lookup")
      setErrorMsg("Product lookup failed. You can enter details manually.")
      setLookupSource("manual")
      setBarcode(code)
      setScanState("review")
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
      await new Promise<void>((res) => {
        img.onload = () => res()
      })
      const result = await reader.decodeFromImageElement(img)
      URL.revokeObjectURL(url)
      const code = result.getText()
      setBarcode(code)
      await handleBarcode(code)
    } catch {
      setBarcode("")
      setLookupSource("manual")
      setQuantity("1")
      setScanState("review")
    }
  }

  async function handleSave() {
    if (!productName.trim() || !homeId) {
      showError("Product name and residence are required.")
      return
    }
    const supabase = createClient()
    if (!supabase) {
      showError(CONFIG_ERROR)
      return
    }
    const userId = await getAuthUserId(supabase)
    if (!userId) {
      showError("You must be signed in.")
      return
    }

    const { error: pantryError } = await supabase.from("pantry_items").insert({
      name: productName.trim(),
      quantity: parseScanQuantityForSave(quantity),
      unit: unit.trim(),
      storage_location: location.trim(),
      category: category.trim() || "Other",
      minimum_quantity: 0,
      status: "OK",
      home_id: homeId,
      barcode: barcode || null,
      notes: notes.trim() || null,
      created_by: userId,
    })

    if (pantryError) {
      logSupabaseError("scan pantry insert", pantryError)
      showError(getSupabaseErrorMessage(pantryError))
      return
    }

    if (barcode.trim()) {
      const { error: catalogError } = await upsertProductCatalog(supabase, userId, {
        barcode,
        productName,
        brand,
        quantity,
        unit,
        category,
        notes,
      })
      if (catalogError) {
        showError(
          "Saved to pantry, but could not update your product catalog. " +
            getSupabaseErrorMessage(catalogError),
        )
      }
    }

    await supabase.from("barcode_scans").insert({
      home_id: homeId,
      user_id: userId,
      barcode: barcode || null,
      product_name: productName.trim(),
      quantity: parseScanQuantityForSave(quantity),
      unit: unit.trim(),
      storage_location: location.trim(),
      scan_mode: "single",
    })

    setScanState("saved")
    showSuccess("Item saved to pantry")
  }

  function resetForAnotherScan() {
    setScanState("scanning")
    setProductName("")
    setBrand("")
    setBarcode("")
    setQuantity("1")
    setUnit("")
    setCategory("Other")
    setNotes("")
    setLocation("")
    setLookupSource("manual")
    setErrorKind("none")
    setErrorMsg("")
    startScanner()
  }

  return (
    <AppShell>
      <MobileTopBar
        backHref="/dashboard"
        title="Scan item"
        trailing={
          <Link
            href="/scan/history"
            className="mobile-header-button inline-flex items-center justify-center rounded-xl text-xs font-bold text-navy-light"
          >
            History
          </Link>
        }
      />

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
                {(
                  [
                    "top-0 left-0",
                    "top-0 right-0",
                    "bottom-0 left-0",
                    "bottom-0 right-0",
                  ] as const
                ).map((pos, i) => (
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
                ))}
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
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-600"
          >
            <Image size={15} />
            Use Photo Library
          </button>
          <button
            type="button"
            onClick={() => {
              stopScanner()
              setLookupSource("manual")
              setQuantity("1")
              setScanState("review")
            }}
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

      {scanState === "review" && (
        <>
          <div className="scan-form-scroll-pad space-y-4">
            <ScanSourceBanner source={lookupSource} barcode={barcode || undefined} />

            <ScanProductFields
              values={{ productName, brand, quantity, unit, category, notes }}
              onChange={(patch) => {
                if (patch.productName !== undefined) setProductName(patch.productName)
                if (patch.brand !== undefined) setBrand(patch.brand)
                if (patch.quantity !== undefined) setQuantity(patch.quantity)
                if (patch.unit !== undefined) setUnit(patch.unit)
                if (patch.category !== undefined) setCategory(patch.category)
                if (patch.notes !== undefined) setNotes(patch.notes)
              }}
              barcode={barcode}
              onBarcodeChange={setBarcode}
              showCatalogNotes
            />

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
          </div>

          <ScanStickyFooter>
            <button
              type="button"
              onClick={handleSave}
              disabled={!productName.trim()}
              className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-navy text-sm font-semibold text-white shadow-soft disabled:opacity-50"
            >
              Save to Pantry
            </button>
            <button
              type="button"
              onClick={resetForAnotherScan}
              className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-600"
            >
              Scan Another
            </button>
          </ScanStickyFooter>
        </>
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
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-200/60 bg-white text-sm font-bold text-slate-600"
              >
                View Pantry
              </button>
            </Link>
            <button
              type="button"
              onClick={resetForAnotherScan}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-navy text-sm font-semibold text-white shadow-soft"
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-stone-200/60 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/15"
      />
    </div>
  )
}

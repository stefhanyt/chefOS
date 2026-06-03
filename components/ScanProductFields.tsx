"use client"

import {
  SCAN_CATEGORIES,
  SCAN_UNIT_SUGGESTIONS,
  isScanCategory,
  mergeCategoryFromSelect,
  normalizeScanQuantityDisplay,
  splitCategoryForSelect,
} from "@/lib/scan-form-options"

const inputDefault =
  "w-full rounded-2xl border border-stone-200/60 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/15"

const inputCompact =
  "w-full rounded-xl border border-stone-200/60 bg-slate-50 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"

const labelDefault =
  "mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500"

const labelCompact =
  "mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500"

export type ScanProductFieldsValues = {
  productName: string
  brand: string
  quantity: string
  unit: string
  category: string
  notes?: string
}

export default function ScanProductFields({
  values,
  onChange,
  variant = "default",
  showCatalogNotes = false,
  barcode,
  onBarcodeChange,
}: {
  values: ScanProductFieldsValues
  onChange: (patch: Partial<ScanProductFieldsValues>) => void
  variant?: "default" | "compact"
  showCatalogNotes?: boolean
  barcode?: string
  onBarcodeChange?: (v: string) => void
}) {
  const compact = variant === "compact"
  const inputClass = compact ? inputCompact : inputDefault
  const labelClass = compact ? labelCompact : labelDefault
  const { select: categorySelect, custom: categoryCustom } =
    splitCategoryForSelect(values.category)

  function setCategoryFromSelect(select: string) {
    onChange({
      category: mergeCategoryFromSelect(select, categoryCustom),
    })
  }

  function setCategoryCustom(custom: string) {
    onChange({
      category: mergeCategoryFromSelect(categorySelect, custom),
    })
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <label className={labelClass}>Product Name</label>
        <input
          type="text"
          value={values.productName}
          onChange={(e) => onChange({ productName: e.target.value })}
          placeholder="e.g. Organic Eggs"
          className={`${inputClass} ${compact ? "font-semibold" : ""}`}
        />
      </div>

      <div>
        <label className={labelClass}>Brand (optional)</label>
        <input
          type="text"
          value={values.brand}
          onChange={(e) => onChange({ brand: e.target.value })}
          placeholder="e.g. Kirkland"
          className={inputClass}
        />
      </div>

      {onBarcodeChange != null && !barcode?.trim() ? (
        <div>
          <label className={labelClass}>Barcode (optional)</label>
          <input
            type="text"
            value={barcode ?? ""}
            onChange={(e) => onBarcodeChange(e.target.value)}
            placeholder="Enter barcode number"
            className={inputClass}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Quantity</label>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            value={values.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            onBlur={() =>
              onChange({ quantity: normalizeScanQuantityDisplay(values.quantity) })
            }
            placeholder="1"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Unit</label>
          <input
            type="text"
            list="scan-unit-suggestions"
            value={values.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            placeholder="e.g. bottle"
            className={inputClass}
          />
        </div>
      </div>

      <datalist id="scan-unit-suggestions">
        {SCAN_UNIT_SUGGESTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <div>
        <label className={labelClass}>Category</label>
        <select
          value={categorySelect}
          onChange={(e) => setCategoryFromSelect(e.target.value)}
          className={inputClass}
        >
          {SCAN_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {categorySelect === "Other" && (
          <input
            type="text"
            value={isScanCategory(values.category) ? "" : values.category}
            onChange={(e) => setCategoryCustom(e.target.value)}
            placeholder="Custom category (optional)"
            className={`${inputClass} mt-2`}
          />
        )}
      </div>

      {showCatalogNotes && (
        <div>
          <label className={labelClass}>Catalog notes (optional)</label>
          <input
            type="text"
            value={values.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Saved for next scan of this barcode"
            className={inputClass}
          />
        </div>
      )}
    </div>
  )
}

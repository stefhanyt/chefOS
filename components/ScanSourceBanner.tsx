import { Check, AlertCircle, BookMarked } from "lucide-react"
import {
  LOOKUP_SOURCE_MESSAGES,
  type ProductLookupSource,
} from "@/lib/scan-product"

export default function ScanSourceBanner({
  source,
  barcode,
}: {
  source: ProductLookupSource
  barcode?: string
}) {
  const message = LOOKUP_SOURCE_MESSAGES[source]
  const isManual = source === "manual"
  const isCatalog = source === "catalog"

  return (
    <div
      className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
        isManual
          ? "bg-amber-50 text-amber-800"
          : isCatalog
            ? "bg-navy/5 text-navy"
            : "bg-green-50 text-green-700"
      }`}
    >
      {isManual ? (
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
      ) : isCatalog ? (
        <BookMarked size={15} className="mt-0.5 shrink-0" />
      ) : (
        <Check size={15} className="mt-0.5 shrink-0" />
      )}
      <span>
        {message}
        {barcode ? (
          <span className="mt-0.5 block font-normal opacity-80">
            Barcode: {barcode}
          </span>
        ) : null}
      </span>
    </div>
  )
}

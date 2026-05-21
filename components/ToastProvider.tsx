"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { AlertCircle, Check } from "lucide-react"
import { generateClientId, isBrowser } from "@/lib/safe-client"

type ToastType = "success" | "error"

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const noopToast = () => {}

const fallbackValue: ToastContextValue = {
  showSuccess: noopToast,
  showError: noopToast,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType) => {
      const id = generateClientId()
      setToasts((prev) => [...prev, { id, message, type }])
      if (isBrowser()) {
        window.setTimeout(() => dismiss(id), 4000)
      }
    },
    [dismiss],
  )

  const showSuccess = useCallback(
    (message: string) => addToast(message, "success"),
    [addToast],
  )

  const showError = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast],
  )

  const value = useMemo(
    () => ({ showSuccess, showError }),
    [showSuccess, showError],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed left-4 right-4 top-4 z-[110] mx-auto flex max-w-md flex-col gap-2 pt-[env(safe-area-inset-top)]"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3.5 text-sm font-medium shadow-card-lg backdrop-blur-sm ${
              toast.type === "success"
                ? "border-navy/10 bg-navy text-ivory"
                : "border-rose-200/80 bg-surface text-rose-800"
            }`}
          >
            {toast.type === "success" ? (
              <Check size={16} className="shrink-0 text-gold-light" strokeWidth={2} />
            ) : (
              <AlertCircle size={16} className="shrink-0 text-rose-600" strokeWidth={1.5} />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  return ctx ?? fallbackValue
}

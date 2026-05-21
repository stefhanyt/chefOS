"use client"

import { useEffect } from "react"
import { isBrowser } from "@/lib/safe-client"

/**
 * Production PWA: register SW after load.
 * Clears stale caches on activate to avoid mobile crashes from mismatched _next/static chunks.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!isBrowser() || !("serviceWorker" in navigator)) return

    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister()
        })
      })
      return
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing
            if (!installing) return
            installing.addEventListener("statechange", () => {
              if (installing.state === "activated" && navigator.serviceWorker.controller) {
                void caches.keys().then((keys) => {
                  keys.forEach((key) => {
                    if (key.startsWith("next-static")) {
                      void caches.delete(key)
                    }
                  })
                })
              }
            })
          })
        })
        .catch(() => {
          /* SW optional */
        })
    }

    if (document.readyState === "complete") {
      register()
    } else {
      window.addEventListener("load", register, { once: true })
    }
  }, [])

  return null
}

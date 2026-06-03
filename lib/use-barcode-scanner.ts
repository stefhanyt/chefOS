"use client"

import { useCallback, useEffect, useRef } from "react"
import {
  captureStreamFromVideo,
  releaseScannerRefs,
  type BarcodeReaderHandle,
  type ScannerControlsHandle,
  type UseBarcodeScannerRefs,
} from "@/lib/barcode-scanner"

export type BarcodeDetectedHandler = (code: string) => void | Promise<void>

export type StartBarcodeScannerOptions = {
  /** If false, stop camera after first successful decode (default). */
  continuous?: boolean
  onDetected: BarcodeDetectedHandler
  onError?: (error: unknown) => void
}

/**
 * Shared camera lifecycle for /scan and /scan/batch.
 * Call `release` when leaving scan UI; call `start` only while actively scanning.
 */
export function useBarcodeScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const readerRef = useRef<BarcodeReaderHandle | null>(null)
  const controlsRef = useRef<ScannerControlsHandle>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const activeRef = useRef(false)
  const startingRef = useRef(false)
  const sessionRef = useRef(0)

  const refs: UseBarcodeScannerRefs = {
    videoRef,
    readerRef,
    controlsRef,
    streamRef,
    activeRef,
    sessionRef,
  }

  const release = useCallback(() => {
    releaseScannerRefs(refs)
    startingRef.current = false
  }, [])

  const start = useCallback(
    async ({ continuous = false, onDetected, onError }: StartBarcodeScannerOptions) => {
      if (startingRef.current || activeRef.current) return

      const session = sessionRef.current + 1
      sessionRef.current = session
      startingRef.current = true
      release()

      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser")
        if (session !== sessionRef.current) return

        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader as BarcodeReaderHandle

        const constraints: MediaStreamConstraints = {
          video: { facingMode: { ideal: "environment" } },
        }

        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (session !== sessionRef.current) return

        const video = videoRef.current
        if (!video) {
          startingRef.current = false
          return
        }

        const controls = await reader.decodeFromConstraints(
          constraints,
          video,
          async (result) => {
            if (!result || session !== sessionRef.current) return
            const code = result.getText()
            if (!continuous) {
              release()
            }
            await onDetected(code)
          },
        )

        if (session !== sessionRef.current) {
          try {
            controls?.stop?.()
          } catch {
            /* ignore */
          }
          return
        }

        controlsRef.current = controls as ScannerControlsHandle
        activeRef.current = true
        captureStreamFromVideo(video, streamRef)
      } catch (e) {
        if (session === sessionRef.current) {
          activeRef.current = false
          readerRef.current = null
          controlsRef.current = null
          onError?.(e)
        }
      } finally {
        if (session === sessionRef.current) {
          startingRef.current = false
        }
      }
    },
    [release],
  )

  useEffect(() => {
    return () => release()
  }, [release])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") release()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [release])

  useEffect(() => {
    const onPageHide = () => release()
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [release])

  return { videoRef, release, start, isActive: () => activeRef.current }
}

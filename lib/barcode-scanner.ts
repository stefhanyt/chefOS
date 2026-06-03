import type { MutableRefObject, RefObject } from "react"
import type { IScannerControls } from "@zxing/browser"

/** ZXing browser reader — minimal surface for cleanup */
export type BarcodeReaderHandle = {
  reset?: () => void
  stopContinuousDecode?: () => void
}

export type ScannerControlsHandle = IScannerControls | null

export type ReleaseBarcodeScannerOptions = {
  reader?: BarcodeReaderHandle | null
  controls?: ScannerControlsHandle
  video?: HTMLVideoElement | null
  streamRef?: MutableRefObject<MediaStream | null>
}

/**
 * Stops ZXing decode and all camera MediaStream tracks (fixes iOS indicator staying on).
 */
function stopMediaStreamTracks(stream: MediaStream | null | undefined): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      /* ignore */
    }
  }
}

/**
 * ZXing tracks every getUserMedia stream in streamTracker — must clear on release (iOS indicator).
 */
export async function releaseAllZxingCameraStreams(): Promise<void> {
  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser")
    BrowserMultiFormatReader.releaseAllStreams()
  } catch {
    /* ignore */
  }
}

export function releaseBarcodeScanner({
  reader,
  controls,
  video,
  streamRef,
}: ReleaseBarcodeScannerOptions): void {
  try {
    controls?.stop?.()
  } catch {
    /* ignore */
  }
  try {
    reader?.stopContinuousDecode?.()
  } catch {
    /* ignore */
  }
  try {
    reader?.reset?.()
  } catch {
    /* ignore */
  }

  const fromVideo =
    video?.srcObject instanceof MediaStream ? video.srcObject : null
  const stream = streamRef?.current ?? fromVideo

  stopMediaStreamTracks(stream)

  if (streamRef) streamRef.current = null

  if (video) {
    try {
      video.pause()
    } catch {
      /* ignore */
    }
    video.srcObject = null
    video.removeAttribute("src")
  }

  void releaseAllZxingCameraStreams().then(async () => {
    if (!video) return
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser")
      BrowserMultiFormatReader.cleanVideoSource(video)
    } catch {
      /* ignore */
    }
  })
}

/** After ZXing attaches getUserMedia, copy stream ref from the video element. */
export function captureStreamFromVideo(
  video: HTMLVideoElement | null | undefined,
  streamRef: MutableRefObject<MediaStream | null>,
): void {
  if (!video) return
  const apply = () => {
    if (video.srcObject instanceof MediaStream) {
      streamRef.current = video.srcObject
    }
  }
  apply()
  video.addEventListener("loadedmetadata", apply, { once: true })
}

export type UseBarcodeScannerRefs = {
  videoRef: RefObject<HTMLVideoElement | null>
  readerRef: MutableRefObject<BarcodeReaderHandle | null>
  controlsRef: MutableRefObject<ScannerControlsHandle>
  streamRef: MutableRefObject<MediaStream | null>
  activeRef: MutableRefObject<boolean>
  sessionRef: MutableRefObject<number>
}

export function releaseScannerRefs(refs: UseBarcodeScannerRefs): void {
  refs.sessionRef.current += 1
  refs.activeRef.current = false
  releaseBarcodeScanner({
    reader: refs.readerRef.current,
    controls: refs.controlsRef.current,
    video: refs.videoRef.current,
    streamRef: refs.streamRef,
  })
  refs.readerRef.current = null
  refs.controlsRef.current = null
}

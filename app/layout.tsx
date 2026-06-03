import type { Metadata, Viewport } from "next"
import { Inter, Cormorant_Garamond } from "next/font/google"
import "./globals.css"
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration"
import { ToastProvider } from "@/components/ToastProvider"
import { supabaseEnv } from "@/lib/env"

void supabaseEnv

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-display",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0F2438",
}

export const metadata: Metadata = {
  title: {
    default: "ChefOS",
    template: "%s | ChefOS",
  },
  description: "Private residence operations — pantry, meals, and household coordination",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ChefOS",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "msapplication-TileColor": "#0F2438",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className={`${inter.className} min-h-dvh bg-ivory text-charcoal antialiased`}>
        <ToastProvider>
          <ServiceWorkerRegistration />
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}

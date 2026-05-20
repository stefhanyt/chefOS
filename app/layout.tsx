import type { Metadata, Viewport } from "next"
import "./globals.css"
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration"
// Importing supabaseEnv here triggers the startup env-check warning in the terminal
import { supabaseEnv } from "@/lib/env"

// Suppress "unused import" — the import exists for its server-side side-effect
void supabaseEnv

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0F2A55",
}

export const metadata: Metadata = {
  title: {
    default: "ChefOS",
    template: "%s | ChefOS",
  },
  description: "Private chef command center",
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
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Splash screen color for iOS during launch */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="msapplication-TileColor" content="#0F2A55" />
        <link rel="mask-icon" href="/icons/icon.svg" color="#0F2A55" />
      </head>
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  )
}

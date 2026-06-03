"use client"

import { ResidenceProvider } from "@/contexts/ResidenceContext"

export default function AppProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return <ResidenceProvider>{children}</ResidenceProvider>
}

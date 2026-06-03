"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Package, Users, ChefHat, X } from "lucide-react"
import { useResidence } from "@/contexts/ResidenceContext"
import { ONBOARDING_DISMISS_KEY } from "@/lib/residence-storage"
import { ui } from "@/lib/ui"

export default function OnboardingGuide() {
  const { homes, loading } = useResidence()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(localStorage.getItem(ONBOARDING_DISMISS_KEY) === "1")
  }, [])

  if (loading || dismissed) return null

  if (homes.length === 0) {
    return (
      <div className={`${ui.cardElevated} mb-6 border-2 border-gold/25 p-5`}>
        <h2 className="font-display text-lg font-semibold text-charcoal">
          Welcome to ChefOS
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Start by creating your first residence. Each home has its own pantry,
          shopping list, meals, and team.
        </p>
        <Link href="/homes" className={`${ui.btnPrimary} mt-4 inline-flex`}>
          Create your first residence
        </Link>
      </div>
    )
  }

  if (homes.length >= 2) return null

  return (
    <div className={`${ui.cardElevated} relative mb-6 border-2 border-gold/25 p-5`}>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(ONBOARDING_DISMISS_KEY, "1")
          setDismissed(true)
        }}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
      <h2 className="pr-8 font-display text-lg font-semibold text-charcoal">
        {homes[0].name} is ready
      </h2>
      <p className="mt-1 text-sm text-stone-500">Suggested next steps:</p>
      <ul className="mt-4 space-y-2">
        <OnboardingStep
          href="/pantry"
          icon={<Package size={16} />}
          label="Add pantry items"
        />
        <OnboardingStep
          href="/settings/team"
          icon={<Users size={16} />}
          label="Invite your team"
        />
        <OnboardingStep
          href="/dish-library"
          icon={<ChefHat size={16} />}
          label="Build your dish repertoire"
        />
      </ul>
    </div>
  )
}

function OnboardingStep({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-[44px] items-center gap-3 rounded-xl border border-stone-200/60 bg-stone-50/50 px-4 py-3 text-sm font-semibold text-charcoal transition active:bg-stone-100"
      >
        <span className="text-navy-light">{icon}</span>
        {label}
      </Link>
    </li>
  )
}

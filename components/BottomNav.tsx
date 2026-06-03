"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ShoppingCart, UtensilsCrossed, Settings, Package } from "lucide-react"
import { BOTTOM_NAV_CLASS } from "@/lib/app-layout"

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/pantry", label: "Pantry", icon: Package },
  { href: "/shopping-list", label: "Shop", icon: ShoppingCart },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/settings", label: "More", icon: Settings },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className={`${BOTTOM_NAV_CLASS} border-t border-stone-200/60 bg-surface/95 shadow-nav backdrop-blur-xl`}
      aria-label="Main navigation"
    >
      <div className="app-bottom-nav-inner mx-auto flex max-w-md items-stretch justify-around px-2 pb-2 pt-1.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={`
                relative flex min-h-[48px] min-w-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5
                text-[10px] font-semibold tracking-wide transition-colors
                ${active ? "text-navy" : "text-stone-400"}
              `}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gold"
                  aria-hidden
                />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.5}
                className={active ? "text-navy" : "text-stone-400"}
              />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

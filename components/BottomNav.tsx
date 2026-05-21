"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ShoppingCart, UtensilsCrossed, Settings, Package } from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/pantry", label: "Pantry", icon: Package },
  { href: "/shopping-list", label: "Shopping", icon: ShoppingCart },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/settings", label: "Settings", icon: Settings },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="
        fixed bottom-4 left-1/2 z-40
        flex w-[calc(100%-32px)] max-w-md
        -translate-x-1/2
        items-center justify-around
        rounded-[28px]
        border border-white/50
        bg-white/90 backdrop-blur-2xl
        px-4 py-4
        shadow-2xl shadow-slate-900/10
      "
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={href}
            href={href}
            className={`
              flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1
              text-xs font-bold transition-colors
              ${active ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}
            `}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

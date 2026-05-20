"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import SignOutButton from "@/components/SignOutButton"
import { createClient } from "@/lib/supabase/client"
import { mockProfiles } from "@/lib/mock-data"
import { Users, Home, Bell, Shield, ChevronRight } from "lucide-react"
import type { Profile } from "@/lib/types"

const settingsGroups = [
  {
    group: "Account",
    items: [
      { label: "Profile", icon: Shield, href: "#" },
    ],
  },
  {
    group: "Management",
    items: [
      {
        label: "Team & Access",
        sub: "Manage staff per residence",
        icon: Users,
        href: "/settings/team",
      },
      {
        label: "Homes",
        sub: "Add or edit residences",
        icon: Home,
        href: "/homes",
      },
    ],
  },
  {
    group: "App",
    items: [
      {
        label: "Notifications",
        sub: "Expiry and restock alerts",
        icon: Bell,
        href: "#",
      },
    ],
  },
]

export default function SettingsPage() {
  const [profile, setProfile] = useState<Pick<Profile, "display_name" | "email" | "role">>({
    display_name: mockProfiles[0].display_name,
    email: mockProfiles[0].email,
    role: mockProfiles[0].role,
  })

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      if (!supabase) return
      const { data } = await supabase
        .from("profiles")
        .select("display_name, email, role")
        .limit(1)
        .maybeSingle()
      if (data) setProfile(data)
    }
    loadProfile()
  }, [])

  const initial = profile.display_name?.charAt(0).toUpperCase() ?? "C"

  return (
    <AppShell>
      <PageHeader title="Settings" />

      {/* PROFILE CARD */}
      <div className="mb-6 rounded-[26px] bg-gradient-to-br from-[#0F2A55] to-[#2563EB] p-6 text-white shadow-xl shadow-blue-500/20">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl font-extrabold backdrop-blur-sm">
            {initial}
          </div>
          <div>
            <h2 className="text-lg font-extrabold">{profile.display_name}</h2>
            <p className="text-sm text-blue-200">{profile.email}</p>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-blue-300">
              {profile.role}
            </p>
          </div>
        </div>
      </div>

      {settingsGroups.map((group) => (
        <div key={group.group} className="mb-5">
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
            {group.group}
          </h2>
          <div className="overflow-hidden rounded-[22px] border border-[#E6EEF8] bg-white shadow-md shadow-slate-900/4">
            {group.items.map((item, i) => {
              const sub =
                "sub" in item
                  ? (item as { sub: string }).sub
                  : `${profile.display_name} · ${profile.email}`
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center justify-between px-5 py-4 transition-colors active:bg-slate-50 ${
                    i < group.items.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <item.icon size={17} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-400">{sub}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      <SignOutButton />
    </AppShell>
  )
}

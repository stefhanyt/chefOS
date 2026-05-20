"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { LogOut } from "lucide-react"

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    if (supabase) {
      await supabase.auth.signOut()
    }
    router.push("/login")
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-[22px] border border-red-100 bg-red-50 py-4 text-sm font-bold text-red-600 transition-colors active:bg-red-100"
    >
      <LogOut size={16} />
      Sign Out
    </button>
  )
}

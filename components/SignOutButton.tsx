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
      type="button"
      onClick={handleSignOut}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200/80 bg-surface py-3.5 text-sm font-semibold text-stone-600 transition active:bg-stone-50"
    >
      <LogOut size={16} strokeWidth={1.5} />
      Sign out
    </button>
  )
}

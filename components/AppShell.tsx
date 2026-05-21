import BottomNav from "./BottomNav"

interface Props {
  children: React.ReactNode
}

export default function AppShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-ivory">
      <main className="mx-auto max-w-md px-5 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

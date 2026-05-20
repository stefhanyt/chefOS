import BottomNav from "./BottomNav"

interface Props {
  children: React.ReactNode
}

export default function AppShell({ children }: Props) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F5F8FC]">
      <main className="mx-auto max-w-md px-4 pt-4 pb-32">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

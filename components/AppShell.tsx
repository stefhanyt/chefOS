import BottomNav from "./BottomNav"
import {
  APP_SHELL_CLASS,
  APP_SHELL_CONTENT_CLASS,
  APP_SHELL_MAIN_CLASS,
} from "@/lib/app-layout"

interface Props {
  children: React.ReactNode
}

/**
 * Mobile-first shell: single scrollable main region + fixed bottom nav.
 * Content padding reserves space so lists never sit under the nav.
 */
export default function AppShell({ children }: Props) {
  return (
    <div className={APP_SHELL_CLASS}>
      <main className={APP_SHELL_MAIN_CLASS}>
        <div className={APP_SHELL_CONTENT_CLASS}>{children}</div>
      </main>
      <BottomNav />
    </div>
  )
}

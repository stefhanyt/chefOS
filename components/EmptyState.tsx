import { Inbox } from "lucide-react"
import { ui } from "@/lib/ui"

export default function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title?: string
  message: string
  icon?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className={ui.empty}>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100/90 text-stone-400">
        {icon ?? <Inbox size={22} strokeWidth={1.5} />}
      </div>
      {title && (
        <p className={`${ui.emptyTitle} font-display text-base tracking-tight`}>
          {title}
        </p>
      )}
      <p className={title ? ui.emptyText : `${ui.emptyText} mt-0`}>
        {message}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

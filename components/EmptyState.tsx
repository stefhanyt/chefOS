import { Inbox } from "lucide-react"

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
    <div className="chef-empty">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100/80 text-stone-400">
        {icon ?? <Inbox size={22} strokeWidth={1.5} />}
      </div>
      {title && (
        <p className="text-sm font-semibold text-charcoal">{title}</p>
      )}
      <p className={`text-sm leading-relaxed text-stone-500 ${title ? "mt-1.5" : ""}`}>
        {message}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

interface Props {
  title?: string
  subtitle?: string
  action?: React.ReactNode
}

export default function PageHeader({ title, subtitle, action }: Props) {
  if (!title && !subtitle && !action) return null

  return (
    <div className="mb-7 flex min-h-[44px] items-start justify-between gap-4">
      <div className="min-w-0">
        {title && (
          <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal">
            {title}
          </h1>
        )}
        {subtitle && (
          <p
            className={`text-sm leading-relaxed text-stone-500 ${title ? "mt-1.5" : ""}`}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

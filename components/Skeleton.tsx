export function Skeleton({ className = "h-20" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-stone-200/50 ${className}`} />
}

export function SkeletonList({ count = 3, className = "h-20" }: { count?: number; className?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  )
}

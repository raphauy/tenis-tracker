// Fallback de Suspense para la timeline (sin loading.tsx, por convención del proyecto).
export function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="mt-3 h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

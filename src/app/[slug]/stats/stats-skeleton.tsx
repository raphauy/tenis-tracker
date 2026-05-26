// Fallback de Suspense para el dashboard de stats (sin loading.tsx, por convención del proyecto).
export function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {/* Hero cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl bg-card py-6 ring-1 ring-foreground/10">
            <div className="mx-auto h-7 w-14 animate-pulse rounded bg-muted" />
            <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Tablas */}
      {[0, 1].map((t) => (
        <div key={t} className="flex flex-col gap-2">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      ))}
    </div>
  )
}

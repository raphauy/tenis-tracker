import { Suspense } from 'react'
import { listForAdmin } from '@/services/external-bracket-service'
import { SOURCES } from '@/lib/cuadros/sources'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CuadrosPanel, type AdminTournament } from './cuadros-panel'

async function PanelData() {
  const tournaments = await listForAdmin()

  // Proyección slim para el cliente: NO mandar data/rawSnapshot (pesados).
  const data: AdminTournament[] = tournaments.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    sourceType: t.sourceType,
    lastSyncedAt: t.lastSyncedAt,
    lastSyncError: t.lastSyncError,
    brackets: t.brackets.map((b) => ({
      id: b.id,
      categoryName: b.categoryName,
      slug: b.slug,
      lastSyncedAt: b.lastSyncedAt,
      lastSyncError: b.lastSyncError,
    })),
  }))

  return <CuadrosPanel sources={SOURCES.map((s) => s.type)} tournaments={data} />
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-40" />
      </div>
      {[0, 1].map((i) => (
        <Card key={i} className="gap-3 py-4">
          <div className="px-6">
            <Skeleton className="h-5 w-56" />
          </div>
          <div className="space-y-2 px-6">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        </Card>
      ))}
    </div>
  )
}

export default function AdminCuadrosPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Cuadros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado de sincronización de los cuadros externos.
        </p>
      </header>
      <Suspense fallback={<PanelSkeleton />}>
        <PanelData />
      </Suspense>
    </main>
  )
}

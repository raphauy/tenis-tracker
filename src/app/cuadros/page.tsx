import { Suspense } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { listTournaments } from '@/services/external-bracket-service'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CuadrosIndexSkeleton } from './cuadros-skeleton'

// Se sirve desde la DB y se refresca con cada sync → dinámica (sin prerender estático).
export const dynamic = 'force-dynamic'

function formatMonthYear(d: Date | null): string {
  if (!d) return ''
  const s = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

async function TournamentsList() {
  const tournaments = await listTournaments()

  if (tournaments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
        Todavía no hay cuadros cargados.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {tournaments.map((t) => {
        const cats = t._count.brackets
        return (
          <li key={t.id}>
            <Link href={`/cuadros/${t.slug}`} className="block">
              <Card className="flex-col items-start gap-1.5 px-4 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{t.name}</span>
                    {t.status === 'ARCHIVED' && (
                      <Badge variant="secondary" className="shrink-0">
                        Finalizado
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatMonthYear(t.startDate)}
                    {cats > 0 && `${t.startDate ? ' · ' : ''}${cats} categoría${cats === 1 ? '' : 's'}`}
                  </p>
                </div>
                {t.lastSyncedAt && (
                  <span className="shrink-0 text-xs text-muted-foreground sm:text-right">
                    actualizado {formatDistanceToNow(t.lastSyncedAt, { locale: es, addSuffix: true })}
                  </span>
                )}
              </Card>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default function CuadrosPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Cuadros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuadros de torneos de tenis, en vivo y archivados.
        </p>
      </header>
      <Suspense fallback={<CuadrosIndexSkeleton />}>
        <TournamentsList />
      </Suspense>
    </main>
  )
}

import Link from 'next/link'
import { getCareerStats } from '@/services/stats-service'
import { ResultBadge } from '@/components/match/result-badge'
import { CategoryBadge } from '@/components/match/category-badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import type { YearRow, CategoryRow } from '@/lib/tennis/stats'
import { H2HList } from './h2h-list'

function formatPct(pct: number | null): string {
  return pct === null ? '—' : `${Math.round(pct * 100)}%`
}

// Card numérica del bloque hero.
function StatCard({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-card py-6 text-center ring-1 ring-foreground/10">
      <span className="font-heading text-2xl font-semibold tabular-nums">{value}</span>
      {note && <span className="mt-0.5 text-xs text-muted-foreground">{note}</span>}
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-heading text-sm font-semibold text-muted-foreground">{children}</h2>
}

// Dashboard de estadísticas del dueño del Perfil. RSC: computa en el server.
// Convenciones de cálculo en docs/context.md § Estadísticas.
export async function Stats({
  ownerId,
  isOwner,
  slug,
}: {
  ownerId: string
  isOwner: boolean
  slug: string
}) {
  const stats = await getCareerStats(ownerId)

  if (!stats.hasData) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center">
        <p className="text-muted-foreground">Todavía no hay estadísticas.</p>
        {isOwner ? (
          <Link
            href={`/${slug}/nuevo`}
            className={cn(buttonVariants({ variant: 'default' }), 'mt-4')}
          >
            + Cargá tu primer torneo
          </Link>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando este jugador cargue partidos, sus estadísticas van a aparecer acá.
          </p>
        )}
      </div>
    )
  }

  const { record, walkoversWon, achievements, byYear, byCategory, h2h } = stats

  return (
    <div className="flex flex-col gap-8">
      {/* Hero cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard
          value={`${record.wins}-${record.losses}`}
          label="Récord"
          note={walkoversWon > 0 ? `+${walkoversWon} W.O.` : undefined}
        />
        <StatCard value={formatPct(record.winPct)} label="Win%" />
        <StatCard value={String(achievements.titles)} label="Títulos" />
        <StatCard value={String(achievements.finals)} label="Finales" />
        <StatCard value={String(achievements.semis)} label="Semis" />
      </div>

      {/* Por categoría */}
      <section>
        <SectionTitle>Por categoría</SectionTitle>
        <CategoryTable rows={byCategory} />
      </section>

      {/* Head-to-head */}
      {h2h.length > 0 && (
        <section>
          <SectionTitle>Rivales frecuentes</SectionTitle>
          <H2HList rows={h2h} />
        </section>
      )}

      {/* Por año — accordion colapsado para no robarle protagonismo al resto */}
      <section>
        <Accordion>
          <AccordionItem value="por-anio">
            <AccordionTrigger className="font-heading text-sm font-semibold text-muted-foreground hover:no-underline">
              Por año
            </AccordionTrigger>
            <AccordionContent>
              <YearTable rows={byYear} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  )
}

function tournamentsLabel(n: number): string {
  return `${n} ${n === 1 ? 'torneo' : 'torneos'}`
}

// Listas (no tablas): se adaptan al ancho del móvil sin desbordarse. Cada fila lleva
// el identificador (año/categoría) + métricas en una línea secundaria, y el mejor
// resultado como badge a la derecha.
function YearTable({ rows }: { rows: YearRow[] }) {
  return (
    <div className="divide-y overflow-hidden rounded-xl border">
      {rows.map((r) => (
        <div key={r.year} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium tabular-nums">{r.year}</span>
            <span className="text-xs text-muted-foreground">
              {tournamentsLabel(r.tournaments)} ·{' '}
              <span className="font-mono tabular-nums">
                {r.wins}-{r.losses}
              </span>{' '}
              · {formatPct(r.winPct)}
            </span>
          </div>
          <ResultBadge result={r.bestResult} compact />
        </div>
      ))}
    </div>
  )
}

function CategoryTable({ rows }: { rows: CategoryRow[] }) {
  return (
    <div className="divide-y overflow-hidden rounded-xl border">
      {rows.map((r) => (
        <div key={r.category} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <CategoryBadge name={r.category} />
              <span
                className="truncate text-xs text-muted-foreground"
                title={r.tournamentNames.join(' · ')}
              >
                {r.tournamentNames.join(' · ')}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {tournamentsLabel(r.tournaments)} ·{' '}
              <span className="font-mono tabular-nums">
                {r.wins}-{r.losses}
              </span>
            </span>
          </div>
          <ResultBadge result={r.bestResult} compact />
        </div>
      ))}
    </div>
  )
}

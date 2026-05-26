import { ChevronDownIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CategoryBadge } from '@/components/match/category-badge'
import { cn } from '@/lib/utils'

// Mockup estático del timeline para la landing. Reproduce los estilos reales de
// `timeline-list.tsx` con datos de ejemplo, pero sin interactividad (decorativo).
// Vive dentro del tema, así que se adapta solo a claro/oscuro.

type PreviewMatch = { round: string; opponent: string; score: string; won: boolean }

function WinLoss({ won }: { won: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-full text-xs font-bold',
        won ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'
      )}
    >
      {won ? 'G' : 'P'}
    </span>
  )
}

const FEATURED_MATCHES: PreviewMatch[] = [
  { round: '16avos', opponent: 'M. Pereyra', score: '6-2 6-1', won: true },
  { round: 'Octavos', opponent: 'J. Rodríguez', score: '7-5 6-4', won: true },
  { round: 'Cuartos', opponent: 'A. Gómez', score: '4-6 6-7', won: false },
]

export function TimelinePreview() {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative mx-auto w-full max-w-md select-none"
    >
      <div className="flex flex-col gap-3">
        {/* Torneo destacado, "expandido" con sus partidos. */}
        <div className="rounded-xl border bg-card px-4 shadow-sm">
          <div className="flex items-start py-3.5">
            <div className="flex flex-1 flex-col gap-4 pr-8">
              <div className="flex items-center gap-2">
                <span className="font-medium">AUT Grados 4ta</span>
                <Badge variant="outline">Cuartos</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                diciembre de 2025 · Los Horneros Raquet Club
              </span>
            </div>
            <CategoryBadge name="4ta" className="mt-0.5" />
          </div>
          <div className="flex flex-col gap-2 pb-3.5">
            {FEATURED_MATCHES.map((m) => (
              <div
                key={m.round}
                className="flex items-center justify-between gap-3 border-t py-2 text-sm first:border-t-0"
              >
                <span className="w-24 shrink-0 text-muted-foreground">{m.round}</span>
                <span className="flex-1 truncate">{m.opponent}</span>
                <span className="inline-flex items-center gap-2">
                  <span className="font-mono text-sm tabular-nums">{m.score}</span>
                  <WinLoss won={m.won} />
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Torneos "colapsados". */}
        <CollapsedCard
          name="Torneo La Academia MG"
          badge={<Badge variant="secondary">Finalista</Badge>}
          meta="marzo de 2026 · Academia MG"
          category="B"
        />
        <CollapsedCard
          name="AUT Grados 5ta"
          badge={<Badge variant="default">Campeón</Badge>}
          meta="febrero de 2026 · Los Horneros Raquet Club"
          category="5ta"
        />
      </div>

      {/* Desvanecido inferior: sugiere que la lista sigue. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />
    </div>
  )
}

function CollapsedCard({
  name,
  badge,
  meta,
  category,
}: {
  name: string
  badge: React.ReactNode
  meta: string
  category: string
}) {
  return (
    <div className="flex items-start rounded-xl border bg-card px-4 py-3.5 shadow-sm">
      <div className="flex flex-1 flex-col gap-4 pr-8">
        <div className="flex items-center gap-2">
          <span className="font-medium">{name}</span>
          {badge}
        </div>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </div>
      <div className="flex items-center gap-2">
        <CategoryBadge name={category} className="mt-0.5" />
        <ChevronDownIcon className="size-4 -rotate-90 text-muted-foreground" />
      </div>
    </div>
  )
}

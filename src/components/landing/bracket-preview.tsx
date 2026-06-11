import { StarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mockup estático de un cuadro para la landing. Reproduce el estilo real de
// `bracket-match.tsx` / `bracket-view.tsx` con datos de ejemplo y sin interactividad
// (decorativo). Dos jugadores quedan marcados como favoritos (fila resaltada + estrella)
// para mostrar la idea de "seguí a tus favoritos en el cuadro". Vive dentro del tema, así
// que se adapta solo a claro/oscuro.

type Slot = { name: string; seed?: number; won?: boolean; fav?: boolean }

// Score desde la perspectiva del ganador (sus games primero); los sets ganados (X > Y) en
// negrita. Mismo criterio que ScoreSets de bracket-match.tsx.
function ScoreSets({ score }: { score: string }) {
  const sets = score.trim().split(/\s+/)
  return (
    <span className="min-w-0 truncate tabular-nums">
      {sets.map((set, i) => {
        const m = set.match(/^(\d+)-(\d+)/)
        const won = m ? Number(m[1]) > Number(m[2]) : false
        return (
          <span key={i}>
            {i > 0 && ', '}
            <span className={cn(won && 'font-semibold text-foreground')}>{set}</span>
          </span>
        )
      })}
    </span>
  )
}

function PreviewRow({ slot, decided }: { slot: Slot; decided: boolean }) {
  const won = !!slot.won
  const fav = !!slot.fav
  return (
    <div className={cn('flex min-h-7 items-center gap-1.5 py-1 pl-1.5 pr-1.5', fav && 'bg-secondary')}>
      <span
        className={cn(
          'w-4 shrink-0 text-right text-[10px] tabular-nums',
          fav ? 'text-secondary-foreground/70' : 'text-muted-foreground'
        )}
      >
        {slot.seed ?? ''}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          won && 'font-semibold',
          fav ? 'text-secondary-foreground' : won ? 'text-foreground' : decided ? 'text-muted-foreground' : undefined
        )}
      >
        {slot.name}
      </span>
      {fav && <StarIcon aria-hidden className="size-3.5 shrink-0 fill-current text-primary" />}
    </div>
  )
}

function PreviewMatch({
  p1,
  p2,
  score,
  pending,
  className,
}: {
  p1: Slot
  p2: Slot
  score?: string
  pending?: boolean
  className?: string
}) {
  const decided = !pending
  return (
    <div className={cn('overflow-hidden rounded-md border bg-card', className)}>
      <PreviewRow slot={p1} decided={decided} />
      <div className="border-t border-border/60" />
      <PreviewRow slot={p2} decided={decided} />
      <div className="flex min-h-6 items-center gap-1.5 border-t bg-muted/30 py-1 pl-1.5 pr-2 text-xs text-muted-foreground">
        <span className="w-4 shrink-0" />
        {pending ? <span>Pendiente</span> : score ? <ScoreSets score={score} /> : null}
      </div>
    </div>
  )
}

// Espina ├ entre las dos semis y la final. Copiado de bracket-view.tsx (parentCount=1).
function Connectors() {
  return (
    <div className="flex w-6 flex-col">
      <div className="h-7 shrink-0" /> {/* alinea con el header de ronda */}
      <div className="relative flex-1">
        <span className="absolute top-1/4 bottom-1/4 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/40" />
        <span className="absolute top-1/4 right-1/2 left-0 h-px bg-muted-foreground/40" />
        <span className="absolute bottom-1/4 right-1/2 left-0 h-px bg-muted-foreground/40" />
        <span className="absolute top-1/2 right-0 left-1/2 h-px bg-muted-foreground/40" />
      </div>
    </div>
  )
}

function RoundHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-7 shrink-0 items-center justify-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  )
}

const CARD_W = 'w-36'

export function BracketPreview() {
  return (
    <div aria-hidden className="pointer-events-none mx-auto w-full max-w-md select-none">
      <div className="flex items-stretch justify-center overflow-hidden">
        {/* Semifinales */}
        <div className="flex flex-col">
          <RoundHeader>Semifinales</RoundHeader>
          <div className="flex flex-1 flex-col">
            <div className="flex shrink-0 items-center px-0.5 py-1">
              <PreviewMatch
                className={CARD_W}
                p1={{ name: 'S. Blanco', seed: 7 }}
                p2={{ name: 'R. Carvalho', seed: 2, won: true, fav: true }}
                score="6-7 7-5 10-4"
              />
            </div>
            <div className="flex shrink-0 items-center px-0.5 py-1">
              <PreviewMatch
                className={CARD_W}
                p1={{ name: 'M. Maciel', seed: 6 }}
                p2={{ name: 'C. Greanjeans', seed: 3, won: true }}
                score="7-5 6-2"
              />
            </div>
          </div>
        </div>

        <Connectors />

        {/* Final */}
        <div className="flex flex-col">
          <RoundHeader>Final</RoundHeader>
          <div className="flex flex-1 flex-col">
            <div className="flex flex-1 items-center px-0.5">
              <PreviewMatch
                className={CARD_W}
                p1={{ name: 'R. Carvalho', seed: 2, fav: true }}
                p2={{ name: 'C. Greanjeans', seed: 3 }}
                pending
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

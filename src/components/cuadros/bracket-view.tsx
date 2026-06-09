import { Fragment } from 'react'
import type { NormalizedBracket } from '@/lib/cuadros/types'
import { shortRoundLabel } from '@/lib/cuadros/round-label'
import { BracketMatch } from './bracket-match'

// Árbol completo del cuadro (layout DESKTOP, RSC estático). Técnica flexbox: cada
// columna se estira a la misma altura (items-stretch); la primera ronda fija la
// altura con bandas naturales y las rondas siguientes reparten esa altura con
// bandas flex-1 → cada partido queda centrado contra el punto medio de sus dos
// hijos. Entre columnas, una columna de conectores dibuja la "fork" (├).

const CARD_W = 'w-44'

function Connectors({ parentCount }: { parentCount: number }) {
  return (
    <div className="flex w-6 flex-col">
      <div className="h-7 shrink-0" /> {/* alinea con el header de ronda */}
      <div className="flex flex-1 flex-col">
        {Array.from({ length: parentCount }).map((_, i) => (
          <div key={i} className="relative flex-1">
            {/* espina vertical entre los dos hijos (25%–75%) */}
            <span className="absolute top-1/4 bottom-1/4 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/40" />
            {/* stub al hijo de arriba */}
            <span className="absolute top-1/4 left-0 right-1/2 h-px bg-muted-foreground/40" />
            {/* stub al hijo de abajo */}
            <span className="absolute bottom-1/4 left-0 right-1/2 h-px bg-muted-foreground/40" />
            {/* stub al padre (derecha, centro vertical) */}
            <span className="absolute top-1/2 left-1/2 right-0 h-px bg-muted-foreground/40" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function BracketView({ bracket }: { bracket: NormalizedBracket }) {
  const { rounds } = bracket

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max items-stretch">
        {rounds.map((round, r) => {
          const isFirst = r === 0
          const next = rounds[r + 1]
          return (
            <Fragment key={round.index}>
              <div className="flex flex-col">
                <div className="flex h-7 shrink-0 items-center justify-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {shortRoundLabel(round)}
                </div>
                <div className="flex flex-1 flex-col">
                  {round.matches.map((m) => (
                    <div
                      key={m.slot}
                      className={isFirst ? 'flex shrink-0 items-center px-0.5 py-1' : 'flex flex-1 items-center px-0.5'}
                    >
                      <BracketMatch match={m} className={CARD_W} />
                    </div>
                  ))}
                </div>
              </div>
              {next && <Connectors parentCount={next.matches.length} />}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

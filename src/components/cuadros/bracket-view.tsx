import { Fragment } from 'react'
import type { NormalizedBracket } from '@/lib/cuadros/types'
import { shortRoundLabel } from '@/lib/cuadros/round-label'
import { cn } from '@/lib/utils'
import { BracketMatch } from './bracket-match'
import { StickyRounds } from './sticky-bars'

// Árbol completo del cuadro (layout DESKTOP, RSC estático). Técnica flexbox: cada
// columna se estira a la misma altura (items-stretch); la primera ronda fija la
// altura con bandas naturales y las rondas siguientes reparten esa altura con
// bandas flex-1 → cada partido queda centrado contra el punto medio de sus dos
// hijos. Entre columnas, una columna de conectores dibuja la "fork" (├).
//
// La fila de rondas vive aparte (barra sticky, ver `sticky-bars.tsx`): por eso el
// ancho de columna —tarjeta + gutter— tiene que salir de las MISMAS constantes acá
// abajo, o los rótulos se desalinean de sus columnas.

const CARD_W = 'w-44'
const COL_PAD = 'px-0.5'
const GUTTER_W = 'w-6'

function Connectors({ parentCount }: { parentCount: number }) {
  return (
    <div className={cn('flex flex-col', GUTTER_W)}>
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
  )
}

// Rótulos de ronda, con el mismo patrón de anchos que el cuerpo (columna + gutter)
// para que cada uno caiga sobre su columna.
function RoundLabels({ rounds }: { rounds: NormalizedBracket['rounds'] }) {
  return (
    <>
      {rounds.map((round, r) => (
        <Fragment key={round.index}>
          <div className={cn('shrink-0', COL_PAD)}>
            <div
              className={cn(
                CARD_W,
                'flex h-7 items-center justify-center text-xs font-semibold uppercase tracking-wide text-muted-foreground'
              )}
            >
              {shortRoundLabel(round)}
            </div>
          </div>
          {rounds[r + 1] && <div className={cn('shrink-0', GUTTER_W)} />}
        </Fragment>
      ))}
    </>
  )
}

export function BracketView({ bracket }: { bracket: NormalizedBracket }) {
  const { rounds } = bracket

  return (
    <StickyRounds head={<RoundLabels rounds={rounds} />}>
      <div className="flex min-w-max items-stretch pt-2">
        {rounds.map((round, r) => {
          const isFirst = r === 0
          const next = rounds[r + 1]
          return (
            <Fragment key={round.index}>
              <div className="flex flex-col">
                {round.matches.map((m) => (
                  <div
                    key={m.slot}
                    className={cn(
                      'flex items-center',
                      COL_PAD,
                      isFirst ? 'shrink-0 py-1' : 'flex-1'
                    )}
                  >
                    <BracketMatch match={m} className={CARD_W} />
                  </div>
                ))}
              </div>
              {next && <Connectors parentCount={next.matches.length} />}
            </Fragment>
          )
        })}
      </div>
    </StickyRounds>
  )
}

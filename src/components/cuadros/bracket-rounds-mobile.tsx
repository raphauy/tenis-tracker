'use client'

import type { NormalizedBracket } from '@/lib/cuadros/types'
import { shortRoundLabel } from '@/lib/cuadros/round-label'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BracketMatch } from './bracket-match'

// Layout MOBILE: navegación por rondas con los Tabs de shadcn, variante `line`
// (underline coherente con el nav del Perfil), subrayado activo en primary y
// estirados a todo el ancho (los triggers ya traen flex-1).
export function BracketRoundsMobile({ bracket }: { bracket: NormalizedBracket }) {
  const first = bracket.rounds[0]?.index ?? 0

  return (
    <Tabs defaultValue={String(first)} className="w-full">
      <TabsList variant="line" className="w-full border-b">
        {bracket.rounds.map((round) => (
          <TabsTrigger key={round.index} value={String(round.index)} className="after:bg-primary">
            {shortRoundLabel(round)}
          </TabsTrigger>
        ))}
      </TabsList>
      {bracket.rounds.map((round) => {
        // Conectores de pareja: los partidos van de a dos (2k, 2k+1) y alimentan el mismo
        // partido de la ronda siguiente. Mostramos un stub horizontal al medio de cada uno
        // y una vertical que une los extremos derechos del par. La Final (1 partido) no lleva
        // líneas, pero el gutter se reserva igual para que el ancho de tarjeta no salte.
        const hasConnectors = round.matches.length > 1
        return (
          <TabsContent key={round.index} value={String(round.index)} className="mt-4">
            <div className="flex flex-col gap-2">
              {round.matches.map((m, i) => {
                const isTop = i % 2 === 0 // arriba del par → su mitad vertical baja; abajo → sube
                const hasPartner = hasConnectors && (isTop ? i + 1 < round.matches.length : true)
                // Separación extra ANTES de cada nuevo par (no dentro del par): agrupa
                // visualmente los dos partidos que se cruzan. No afecta los conectores (la
                // vertical solo une dentro del par, en el gap chico).
                const newPair = hasConnectors && isTop && i > 0
                return (
                  <div key={m.slot} className={cn('flex items-stretch', newPair && 'mt-3')}>
                    <div className="min-w-0 flex-1">
                      <BracketMatch match={m} />
                    </div>
                    {/* Gutter del conector; items-stretch lo iguala al alto de la tarjeta, así
                        top-1/2 es el medio REAL del partido (robusto a alturas distintas). */}
                    <div className="relative w-4 shrink-0" aria-hidden>
                      {hasConnectors && (
                        <span className="absolute top-1/2 left-0 right-1 h-px bg-muted-foreground/40" />
                      )}
                      {hasPartner &&
                        (isTop ? (
                          // baja del medio hasta la mitad del gap (-bottom-1 = 4px sobre los 8 del gap)
                          <span className="absolute top-1/2 -bottom-1 right-1 w-px bg-muted-foreground/40" />
                        ) : (
                          // sube desde la mitad del gap hasta el medio
                          <span className="absolute -top-1 bottom-1/2 right-1 w-px bg-muted-foreground/40" />
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}

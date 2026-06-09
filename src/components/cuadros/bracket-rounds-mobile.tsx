'use client'

import type { NormalizedBracket } from '@/lib/cuadros/types'
import { shortRoundLabel } from '@/lib/cuadros/round-label'
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
      {bracket.rounds.map((round) => (
        <TabsContent key={round.index} value={String(round.index)} className="mt-4">
          <div className="flex flex-col gap-2">
            {round.matches.map((m) => (
              <BracketMatch key={m.slot} match={m} />
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}

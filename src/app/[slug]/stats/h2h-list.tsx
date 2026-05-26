'use client'

import { ROUND_LABELS } from '@/lib/tennis/labels'
import { ScoreDisplay } from '@/components/match/score-display'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { ROUND_ORDER } from '@/lib/tennis/derive'
import type { H2HRow } from '@/lib/tennis/stats'

function formatMonthYear(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso)
  )
}

// Head-to-head contra rivales recurrentes. Fila colapsada "vs. {nombre}  W-L";
// al expandir, el historial de partidos (marcador · torneo · ronda · fecha).
export function H2HList({ rows }: { rows: H2HRow[] }) {
  return (
    <Accordion className="flex flex-col gap-3">
      {rows.map((row) => {
        // Historial cronológico: ronda más alta primero dentro del mismo torneo.
        const matches = [...row.matches].sort(
          (a, b) => ROUND_ORDER.indexOf(b.round) - ROUND_ORDER.indexOf(a.round)
        )
        return (
          <AccordionItem
            key={row.opponentName}
            value={row.opponentName}
            className="rounded-xl border bg-card px-4 shadow-sm"
          >
            <AccordionTrigger className="py-3.5">
              <div className="flex flex-1 items-center justify-between gap-3 pr-8">
                <span className="font-medium">vs. {row.opponentName}</span>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {row.wins}-{row.losses}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-2">
                {matches.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 border-t py-2 text-sm first:border-t-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{m.tournamentName}</span>
                      <span className="text-xs text-muted-foreground">
                        {ROUND_LABELS[m.round]}
                        {m.startDate && ` · ${formatMonthYear(m.startDate)}`}
                      </span>
                    </span>
                    <ScoreDisplay type={m.type} status={m.status} winner={m.winner} sets={m.sets} />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}

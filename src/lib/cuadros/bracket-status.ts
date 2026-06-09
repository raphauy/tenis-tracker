import type { NormalizedBracket } from './types'

// ¿El cuadro está completo? = su última ronda (la Final, 1 partido) está jugada. Señal de
// archivado para fuentes con `archivePolicy: 'completion'` (MUR): la etapa se congela
// cuando todas sus categorías tienen la final jugada. Puro (sin DB), reusable y testeable.
export function isBracketComplete(b: NormalizedBracket): boolean {
  const last = b.rounds[b.rounds.length - 1]
  return !!last && last.matches.length === 1 && last.matches[0].status === 'played'
}

import type { NormalizedBracket } from './types'

// ¿El cuadro está completo? = su última ronda (la Final, 1 partido) está jugada. Señal de
// archivado para fuentes con `archivePolicy: 'completion'` (MUR): la etapa se congela
// cuando todas sus categorías tienen la final jugada. Puro (sin DB), reusable y testeable.
export function isBracketComplete(b: NormalizedBracket): boolean {
  const last = b.rounds[b.rounds.length - 1]
  return !!last && last.matches.length === 1 && last.matches[0].status === 'played'
}

export type BracketProgress =
  | { state: 'champion'; championName: string }
  | { state: 'in-progress'; roundLabel: string }
  | { state: 'not-started' }

// Estado a mostrar de un cuadro en los índices de /cuadros: el campeón (final jugada),
// la ronda más avanzada con partidos jugados ("En curso · Cuartos"), o sin resultados.
// Puro (sin DB), reusable y testeable.
export function bracketProgress(b: NormalizedBracket): BracketProgress {
  if (isBracketComplete(b)) {
    const final = b.rounds[b.rounds.length - 1].matches[0]
    const champion = final.winner === 1 ? final.p1 : final.p2
    if (champion?.name) return { state: 'champion', championName: champion.name }
  }
  for (let i = b.rounds.length - 1; i >= 0; i--) {
    if (b.rounds[i].matches.some((m) => m.status === 'played')) {
      return { state: 'in-progress', roundLabel: b.rounds[i].label }
    }
  }
  return { state: 'not-started' }
}

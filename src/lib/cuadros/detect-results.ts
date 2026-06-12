import type { BracketSlot, NormalizedBracket } from './types'

// Diff de cuadros para el motor de notificaciones: partidos que pasaron a 'played' entre el
// snapshot viejo y el nuevo (transición pending|ausente → played). Puro (sin Prisma). NO
// resuelve identidad de nombres (homónimos/dobles son limitación aceptada) ni deriva el
// outcome: el cruce con favoritos y el outcome (WON/LOST/CHAMPION/FINALIST según el rol del
// favorito) los hace el service. Ver docs/PRPs/notificaciones-prp.md § Motor de detección.

export type DetectedResult = {
  roundIndex: number // round.index (clave estable del partido para dedup)
  matchSlot: number // match.slot
  roundLabel: string
  nextRoundLabel: string | null // ronda a la que avanza el ganador; null en la final
  isFinal: boolean // última ronda → el ganador es CHAMPION y el perdedor FINALIST
  winnerName: string
  loserName: string | null // null si el rival era un BYE (slot ausente/bye)
  score: string | null
  isWalkover: boolean // W.O.: el partido se definió sin jugarse → no hay marcador
}

function realName(slot: BracketSlot | undefined): string | null {
  if (!slot || slot.bye) return null
  const name = slot.name?.trim()
  return name ? name : null
}

// Transiciones a 'played' entre old y next. NO re-dispara partidos ya jugados (una corrección
// de un resultado ya avisado no vuelve a notificar). Los partidos 'bye'/'pending' se ignoran.
export function detectNewResults(
  old: NormalizedBracket,
  next: NormalizedBracket
): DetectedResult[] {
  const results: DetectedResult[] = []
  const lastIndex = next.rounds.length - 1

  next.rounds.forEach((round, i) => {
    const isFinal = i === lastIndex
    const oldRound = old.rounds[i]
    const nextRoundLabel = isFinal ? null : (next.rounds[i + 1]?.label ?? null)

    for (const match of round.matches) {
      if (match.status !== 'played' || !match.winner) continue

      // ¿Ya estaba jugado en el snapshot viejo? → no es una transición nueva.
      const oldMatch = oldRound?.matches.find((om) => om.slot === match.slot)
      if (oldMatch?.status === 'played') continue

      const winnerSlot = match.winner === 1 ? match.p1 : match.p2
      const loserSlot = match.winner === 1 ? match.p2 : match.p1
      const winnerName = realName(winnerSlot)
      if (!winnerName) continue // sin ganador real (no debería ocurrir en 'played'); defensivo

      results.push({
        roundIndex: round.index,
        matchSlot: match.slot,
        roundLabel: round.label,
        nextRoundLabel,
        isFinal,
        winnerName,
        loserName: realName(loserSlot),
        score: match.score?.trim() || null,
        isWalkover: match.outcome === 'walkover',
      })
    }
  })

  return results
}

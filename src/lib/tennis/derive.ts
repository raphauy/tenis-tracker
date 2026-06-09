import { Round, MatchType, MatchStatus, MatchSide } from '@prisma/client'
import type { SetScore } from './set-score'

// Orden del cuadro (de menor a mayor ronda). Coincide con el orden del enum en el schema.
export const ROUND_ORDER: Round[] = [
  Round.CLASIFICACION,
  Round.R32,
  Round.R16,
  Round.OCTAVOS,
  Round.CUARTOS,
  Round.SEMIFINAL,
  Round.FINAL,
]

function roundIndex(round: Round): number {
  return ROUND_ORDER.indexOf(round)
}

// Cuenta sets ganados por cada lado (el super TB cuenta como un set; gana quien tiene más).
function countSetsWon(sets: SetScore[]): { me: number; opp: number } {
  let me = 0
  let opp = 0
  for (const s of sets) {
    if (s.myGames > s.oppGames) me++
    else if (s.oppGames > s.myGames) opp++
  }
  return { me, opp }
}

// Deriva el ganador de un partido. Devuelve null si no se puede determinar
// (ej. NORMAL jugado sin mayoría clara de sets, o BYE).
export function deriveMatchWinner(params: {
  type: MatchType
  sets?: SetScore[] | null
  retiredBy?: MatchSide | null
  walkoverWinner?: MatchSide | null
}): MatchSide | null {
  const { type, sets, retiredBy, walkoverWinner } = params

  switch (type) {
    case MatchType.BYE:
      return null
    case MatchType.WALKOVER:
      return walkoverWinner ?? null
    case MatchType.RETIRO:
      // Gana el que NO se retiró.
      if (!retiredBy) return null
      return retiredBy === MatchSide.ME ? MatchSide.OPPONENT : MatchSide.ME
    case MatchType.NORMAL: {
      if (!sets || sets.length === 0) return null
      const { me, opp } = countSetsWon(sets)
      if (me === opp) return null
      return me > opp ? MatchSide.ME : MatchSide.OPPONENT
    }
    default:
      return null
  }
}

// Resultado derivado de la Participación (ver docs/context.md § Resultado del torneo).
export type EntryResult =
  | { kind: 'CAMPEON' }
  | { kind: 'FINALISTA' }
  | { kind: 'SEMIFINALISTA' }
  | { kind: 'ELIMINADO'; round: Round }
  | { kind: 'EN_CURSO' }

type MatchForResult = {
  round: Round
  status: MatchStatus
  type: MatchType
  winner: MatchSide | null
}

export function deriveTournamentResult(matches: MatchForResult[]): EntryResult {
  // 1) Los BYE no cuentan (ni como jugado ni como programado pendiente).
  const relevant = matches.filter((m) => m.type !== MatchType.BYE)

  // 2) Si hay algún partido programado pendiente, el torneo sigue en curso.
  if (relevant.some((m) => m.status === MatchStatus.SCHEDULED)) {
    return { kind: 'EN_CURSO' }
  }

  // 3) Sin partidos jugados (no-bye) ⇒ en curso.
  const played = relevant.filter((m) => m.status === MatchStatus.PLAYED)
  if (played.length === 0) return { kind: 'EN_CURSO' }

  // 4) Partido jugado de mayor ronda.
  const last = played.reduce((a, b) =>
    roundIndex(b.round) > roundIndex(a.round) ? b : a
  )
  const wonLast = last.winner === MatchSide.ME

  // 5) Derivación por ronda del último partido.
  if (last.round === Round.FINAL) {
    return wonLast ? { kind: 'CAMPEON' } : { kind: 'FINALISTA' }
  }
  if (last.round === Round.SEMIFINAL) {
    // Ganó la semi pero no hay final cargada ⇒ datos incompletos ⇒ en curso.
    return wonLast ? { kind: 'EN_CURSO' } : { kind: 'SEMIFINALISTA' }
  }
  // Perdió antes de semis ⇒ eliminado en esa ronda. Ganó sin partido posterior ⇒ en curso.
  return wonLast ? { kind: 'EN_CURSO' } : { kind: 'ELIMINADO', round: last.round }
}

// Para una Participación EN_CURSO: ¿en qué ronda está el jugador AHORA?
//  - Si hay un partido programado pendiente → su ronda (el de menor ronda, el próximo a jugar).
//  - Si ganó su último partido (no final) y todavía no cargó el siguiente → la ronda siguiente.
//  - Si no hay nada jugado ni programado (recién creada) → null (no se sabe).
export function deriveCurrentRound(matches: MatchForResult[]): Round | null {
  const relevant = matches.filter((m) => m.type !== MatchType.BYE)

  const scheduled = relevant.filter((m) => m.status === MatchStatus.SCHEDULED)
  if (scheduled.length > 0) {
    return scheduled.reduce((a, b) => (roundIndex(b.round) < roundIndex(a.round) ? b : a)).round
  }

  const played = relevant.filter((m) => m.status === MatchStatus.PLAYED)
  if (played.length === 0) return null
  const last = played.reduce((a, b) => (roundIndex(b.round) > roundIndex(a.round) ? b : a))
  if (last.winner === MatchSide.ME && last.round !== Round.FINAL) {
    return ROUND_ORDER[roundIndex(last.round) + 1] ?? null
  }
  return null
}

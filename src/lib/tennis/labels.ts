import { Round, MatchType } from '@prisma/client'
import type { SetScore } from './set-score'
import type { EntryResult } from './derive'

export const ROUND_LABELS: Record<Round, string> = {
  CLASIFICACION: 'Clasificación',
  R32: '32avos',
  R16: '16avos',
  OCTAVOS: 'Octavos',
  CUARTOS: 'Cuartos',
  SEMIFINAL: 'Semifinal',
  FINAL: 'Final',
}

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  NORMAL: 'Normal',
  WALKOVER: 'Walkover (W.O.)',
  RETIRO: 'Retiro',
  BYE: 'Bye',
}

export function entryResultLabel(result: EntryResult): string {
  switch (result.kind) {
    case 'CAMPEON':
      return 'Campeón'
    case 'FINALISTA':
      return 'Finalista'
    case 'SEMIFINALISTA':
      return 'Semifinalista'
    case 'ELIMINADO':
      return `Eliminado en ${ROUND_LABELS[result.round]}`
    case 'EN_CURSO':
      return 'En curso'
  }
}

// Formatea un set: "6-4", con tie-break "7-6(8-6)", super tie-break "[10-8]".
function formatSet(s: SetScore): string {
  if (s.isSuperTb) return `[${s.myGames}-${s.oppGames}]`
  const base = `${s.myGames}-${s.oppGames}`
  if (s.tiebreak) return `${base}(${s.tiebreak.my}-${s.tiebreak.opp})`
  return base
}

// Marcador completo: "6-4 4-6 [10-8]". Vacío si no hay sets.
export function formatSets(sets: SetScore[] | null | undefined): string {
  if (!sets || sets.length === 0) return ''
  return sets.map(formatSet).join(' ')
}

import { Round, MatchType, MatchStatus, MatchSide } from '@prisma/client'
import type { SetScore } from './set-score'
import { ROUND_ORDER, deriveTournamentResult, type EntryResult } from './derive'

// Estadísticas de carrera derivadas del log propio. Convenciones estándar del tenis
// (ATP / Tennis Abstract); ver docs/context.md § Estadísticas. Funciones puras (sin Prisma),
// alimentadas por el stats-service desde EntryWithRelations.

// ---------- Tipos de entrada (mínimos) ----------

export type StatMatch = {
  round: Round
  type: MatchType
  status: MatchStatus
  winner: MatchSide | null
  opponentName: string | null
  sets: SetScore[] | null
}

export type StatEntry = {
  // Año ya resuelto por el service (startDate ?? createdAt).
  year: number
  categoryName: string
  tournamentName: string
  // ISO o null; usado en el historial de H2H.
  startDate: string | null
  matches: StatMatch[]
}

// ---------- Tipos de salida ----------

export type YearRow = {
  year: number
  tournaments: number
  wins: number
  losses: number
  winPct: number | null
  bestResult: EntryResult
}

export type CategoryRow = {
  category: string
  tournaments: number
  wins: number
  losses: number
  bestResult: EntryResult
  // Nombres de los torneos de esta categoría (más recientes primero) para mostrarlos
  // al lado del badge en la UI; el orden depende de startDate ?? year.
  tournamentNames: string[]
}

export type H2HMatch = {
  tournamentName: string
  round: Round
  startDate: string | null
  type: MatchType
  status: MatchStatus
  winner: MatchSide | null
  sets: SetScore[] | null
}

export type H2HRow = {
  opponentName: string
  wins: number
  losses: number
  matches: H2HMatch[]
}

export type CareerStats = {
  hasData: boolean
  record: { wins: number; losses: number; winPct: number | null }
  walkoversWon: number
  achievements: { titles: number; finals: number; semis: number }
  byYear: YearRow[]
  byCategory: CategoryRow[]
  h2h: H2HRow[]
}

// ---------- Helpers ----------

// Cuenta para W/L: partido realmente jugado con ganador (normal o retiro). Walkover/bye/scheduled NO.
function isCountedMatch(m: StatMatch): boolean {
  return (
    m.status === MatchStatus.PLAYED &&
    (m.type === MatchType.NORMAL || m.type === MatchType.RETIRO) &&
    m.winner !== null
  )
}

// Rango para "mejor resultado": CAMPEON > FINALISTA > SEMIFINALISTA > ELIMINADO(ronda) > EN_CURSO.
function resultRank(result: EntryResult): number {
  switch (result.kind) {
    case 'CAMPEON':
      return 300
    case 'FINALISTA':
      return 200
    case 'SEMIFINALISTA':
      return 100
    case 'ELIMINADO':
      return ROUND_ORDER.indexOf(result.round) // 0..4 (FINAL/SEMI no caen acá)
    case 'EN_CURSO':
      return -1
  }
}

function winPct(wins: number, losses: number): number | null {
  const played = wins + losses
  return played === 0 ? null : wins / played
}

// Acumula W/L de un set de partidos (solo los contados).
function tallyRecord(matches: StatMatch[]): { wins: number; losses: number } {
  let wins = 0
  let losses = 0
  for (const m of matches) {
    if (!isCountedMatch(m)) continue
    if (m.winner === MatchSide.ME) wins++
    else losses++
  }
  return { wins, losses }
}

// ---------- Cálculo principal ----------

export function computeCareerStats(entries: StatEntry[]): CareerStats {
  const allMatches = entries.flatMap((e) => e.matches)

  // Récord global + walkovers ganados (informativo).
  const { wins, losses } = tallyRecord(allMatches)
  const walkoversWon = allMatches.filter(
    (m) =>
      m.status === MatchStatus.PLAYED &&
      m.type === MatchType.WALKOVER &&
      m.winner === MatchSide.ME
  ).length

  const hasData = allMatches.some(
    (m) => m.status === MatchStatus.PLAYED && m.type !== MatchType.BYE
  )

  // Logros acumulativos (solo resultado cerrado; EN_CURSO/ELIMINADO no suman).
  const results = entries.map((e) => deriveTournamentResult(e.matches))
  const titles = results.filter((r) => r.kind === 'CAMPEON').length
  const finals = results.filter((r) => r.kind === 'CAMPEON' || r.kind === 'FINALISTA').length
  const semis = results.filter(
    (r) => r.kind === 'CAMPEON' || r.kind === 'FINALISTA' || r.kind === 'SEMIFINALISTA'
  ).length

  // Tablas por año y por categoría.
  const byYear = aggregateByYear(entries)
  const byCategory = aggregateByCategory(entries)

  // Head-to-head.
  const h2h = aggregateH2H(entries)

  return {
    hasData,
    record: { wins, losses, winPct: winPct(wins, losses) },
    walkoversWon,
    achievements: { titles, finals, semis },
    byYear,
    byCategory,
    h2h,
  }
}

function aggregateByYear(entries: StatEntry[]): YearRow[] {
  const groups = new Map<number, StatEntry[]>()
  for (const e of entries) {
    const list = groups.get(e.year)
    if (list) list.push(e)
    else groups.set(e.year, [e])
  }

  const rows: YearRow[] = []
  for (const [year, group] of groups) {
    const { wins, losses } = tallyRecord(group.flatMap((e) => e.matches))
    rows.push({
      year,
      tournaments: group.length,
      wins,
      losses,
      winPct: winPct(wins, losses),
      bestResult: bestResultOf(group),
    })
  }
  // Año más reciente primero.
  return rows.sort((a, b) => b.year - a.year)
}

function aggregateByCategory(entries: StatEntry[]): CategoryRow[] {
  const groups = new Map<string, StatEntry[]>()
  for (const e of entries) {
    const list = groups.get(e.categoryName)
    if (list) list.push(e)
    else groups.set(e.categoryName, [e])
  }

  const rows: CategoryRow[] = []
  for (const [category, group] of groups) {
    const { wins, losses } = tallyRecord(group.flatMap((e) => e.matches))
    // Más recientes primero; null al final, desempate alfabético descendente.
    const sortedGroup = [...group].sort((a, b) => {
      const aKey = a.startDate ?? `${a.year}-00-00`
      const bKey = b.startDate ?? `${b.year}-00-00`
      return bKey.localeCompare(aKey)
    })
    rows.push({
      category,
      tournaments: group.length,
      wins,
      losses,
      bestResult: bestResultOf(group),
      tournamentNames: sortedGroup.map((e) => e.tournamentName),
    })
  }
  // Más torneos jugados primero; desempate alfabético.
  return rows.sort((a, b) => b.tournaments - a.tournaments || a.category.localeCompare(b.category))
}

// El mejor resultado derivado del grupo de participaciones.
function bestResultOf(group: StatEntry[]): EntryResult {
  return group
    .map((e) => deriveTournamentResult(e.matches))
    .reduce((best, r) => (resultRank(r) > resultRank(best) ? r : best))
}

function aggregateH2H(entries: StatEntry[]): H2HRow[] {
  type Acc = { wins: number; losses: number; matches: H2HMatch[] }
  const groups = new Map<string, Acc>()

  for (const e of entries) {
    for (const m of e.matches) {
      if (m.opponentName === null) continue // BYE: sin rival.
      const acc = groups.get(m.opponentName) ?? { wins: 0, losses: 0, matches: [] }
      acc.matches.push({
        tournamentName: e.tournamentName,
        round: m.round,
        startDate: e.startDate,
        type: m.type,
        status: m.status,
        winner: m.winner,
        sets: m.sets,
      })
      if (isCountedMatch(m)) {
        if (m.winner === MatchSide.ME) acc.wins++
        else acc.losses++
      }
      groups.set(m.opponentName, acc)
    }
  }

  const rows: H2HRow[] = []
  for (const [opponentName, acc] of groups) {
    // Solo rivales recurrentes: 2+ partidos contados (normal/retiro).
    if (acc.wins + acc.losses < 2) continue
    rows.push({ opponentName, wins: acc.wins, losses: acc.losses, matches: acc.matches })
  }
  // Más enfrentamientos primero (incluye W.O. del historial); desempate por nombre.
  return rows.sort(
    (a, b) => b.matches.length - a.matches.length || a.opponentName.localeCompare(b.opponentName)
  )
}

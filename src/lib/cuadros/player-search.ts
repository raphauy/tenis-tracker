import { normalizeName } from '@/lib/text'
import type { MatchOutcome, NormalizedBracket } from './types'

// Buscador de jugador en los cuadros externos. Puro (sin Prisma): el service le pasa los
// cuadros y acá se arma, por cada jugador que matchea, la lista de sus partidos y el
// récord contra cada rival. La identidad es el nombre normalizado (igual que Favoritos):
// el cuadro solo trae strings, así que dos grafías distintas son dos jugadores.

export const MIN_QUERY_LENGTH = 2

// Un cuadro con el contexto de su torneo, tal como lo necesita la búsqueda.
export type SearchSource = {
  tournamentName: string
  tournamentSlug: string
  startDate: string | null // ISO
  categoryName: string
  categorySlug: string
  bracket: NormalizedBracket
}

export type PlayerMatch = {
  key: string // estable dentro del resultado (torneo/categoría/ronda/slot)
  tournamentName: string
  tournamentSlug: string
  categoryName: string
  categorySlug: string
  startDate: string | null
  roundIndex: number
  roundLabel: string
  opponentName: string
  opponentKey: string
  status: 'pending' | 'played'
  won: boolean | null // null = pendiente (o jugado sin ganador en la fuente)
  score?: string // crudo, desde la perspectiva del GANADOR
  outcome?: MatchOutcome
  h2h?: HeadToHead // récord contra este rival; solo si se cruzaron 2+ veces
}

// Récord contra un rival. `total` cuenta todos los cruces (incluye W.O. y pendientes);
// wins/losses solo los realmente jugados (normal/retiro), como el Récord W/L del glosario.
export type HeadToHead = { total: number; wins: number; losses: number }

export type PlayerResult = {
  nameKey: string
  name: string
  wins: number
  losses: number
  matches: PlayerMatch[] // más reciente primero
}

export type PlayerSearchResult = {
  players: PlayerResult[]
  total: number // jugadores que matchean, antes del tope
}

// Palabras de la búsqueda, normalizadas (sin tildes, minúsculas).
function queryTokens(query: string): string[] {
  return normalizeName(query).split(' ').filter(Boolean)
}

export function isSearchableQuery(query: string): boolean {
  return queryTokens(query).join('').length >= MIN_QUERY_LENGTH
}

// El score crudo viene desde el GANADOR (sus games primero). Para mostrarlo desde el jugador
// buscado, si perdió se invierte cada set conservando el sufijo (ej. tie-break "7-6(5)").
export function orientScore(score: string, won: boolean | null): string {
  if (won !== false) return score
  return score
    .trim()
    .split(/\s+/)
    .map((set) => set.replace(/^(\d+)-(\d+)/, '$2-$1'))
    .join(' ')
}

// Cuenta para el récord: se jugó de verdad (no W.O.) y la fuente dice quién ganó.
function isCounted(m: PlayerMatch): boolean {
  return m.status === 'played' && m.won !== null && m.outcome !== 'walkover'
}

function compareMatches(a: PlayerMatch, b: PlayerMatch): number {
  // Fecha del torneo desc (sin fecha al final); dentro del torneo, ronda más alta primero.
  if (a.startDate !== b.startDate) {
    if (a.startDate === null) return 1
    if (b.startDate === null) return -1
    return b.startDate.localeCompare(a.startDate)
  }
  // Los slugs desempatan torneos/categorías homónimos: cada cuadro queda contiguo.
  return (
    a.tournamentName.localeCompare(b.tournamentName, 'es') ||
    a.tournamentSlug.localeCompare(b.tournamentSlug) ||
    a.categoryName.localeCompare(b.categoryName, 'es') ||
    a.categorySlug.localeCompare(b.categorySlug) ||
    b.roundIndex - a.roundIndex
  )
}

export function searchPlayers(
  sources: SearchSource[],
  query: string,
  limit = 20
): PlayerSearchResult {
  if (!isSearchableQuery(query)) return { players: [], total: 0 }
  const tokens = queryTokens(query)
  const matchesQuery = (nameKey: string) => tokens.every((t) => nameKey.includes(t))

  type Acc = { name: string; nameDate: string | null; matches: PlayerMatch[] }
  const byPlayer = new Map<string, Acc>()

  for (const src of sources) {
    for (const round of src.bracket.rounds) {
      for (const m of round.matches) {
        // Solo cruces reales: dos jugadores, ninguno BYE.
        if (m.status === 'bye' || !m.p1 || !m.p2 || m.p1.bye || m.p2.bye) continue
        const sides = [
          { me: m.p1, opp: m.p2, pos: 1 as const },
          { me: m.p2, opp: m.p1, pos: 2 as const },
        ]
        for (const { me, opp, pos } of sides) {
          const nameKey = normalizeName(me.name)
          if (!nameKey || !matchesQuery(nameKey)) continue
          const played = m.status === 'played'
          const acc = byPlayer.get(nameKey) ?? { name: me.name, nameDate: src.startDate, matches: [] }
          // Nombre a mostrar: la grafía del torneo más reciente.
          if ((src.startDate ?? '') > (acc.nameDate ?? '')) {
            acc.name = me.name
            acc.nameDate = src.startDate
          }
          acc.matches.push({
            key: `${src.tournamentSlug}/${src.categorySlug}/${round.index}/${m.slot}`,
            tournamentName: src.tournamentName,
            tournamentSlug: src.tournamentSlug,
            categoryName: src.categoryName,
            categorySlug: src.categorySlug,
            startDate: src.startDate,
            roundIndex: round.index,
            roundLabel: round.label,
            opponentName: opp.name,
            opponentKey: normalizeName(opp.name),
            status: played ? 'played' : 'pending',
            won: played && m.winner ? m.winner === pos : null,
            score: played ? m.score : undefined,
            outcome: played ? m.outcome : undefined,
          })
          byPlayer.set(nameKey, acc)
        }
      }
    }
  }

  const all: PlayerResult[] = []
  for (const [nameKey, acc] of byPlayer) {
    const matches = acc.matches.sort(compareMatches)
    let wins = 0
    let losses = 0
    // Map (no objeto plano): la clave es un nombre arbitrario y no debe chocar con el prototipo.
    const h2h = new Map<string, HeadToHead>()
    for (const m of matches) {
      let rec = h2h.get(m.opponentKey)
      if (!rec) {
        rec = { total: 0, wins: 0, losses: 0 }
        h2h.set(m.opponentKey, rec)
      }
      rec.total++
      if (!isCounted(m)) continue
      if (m.won) {
        wins++
        rec.wins++
      } else {
        losses++
        rec.losses++
      }
    }
    for (const m of matches) {
      const rec = h2h.get(m.opponentKey)
      if (rec && rec.total >= 2) m.h2h = rec
    }
    all.push({ nameKey, name: acc.name, wins, losses, matches })
  }

  all.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { players: all.slice(0, limit), total: all.length }
}

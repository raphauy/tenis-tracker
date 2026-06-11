// Parser POSICIONAL y PURO de las planillas de La Academia MG (sin fetch, sin env,
// sin Prisma → testeable con fixtures CSV reales). La planilla es manual y ruidosa;
// el parseo se hace por GEOMETRÍA (posición fila/columna), no por los textos de header
// (corridos 1 columna) ni por igualdad de nombres (hay typos). Ver research § 4.1 y
// docs/PRPs/cuadros-prp.md § Known Gotchas.

import type {
  BracketSlot,
  MatchOutcome,
  NormalizedBracket,
  NormalizedMatch,
  NormalizedRound,
} from '@/lib/cuadros/types'
import { roundLabel } from '@/lib/cuadros/round-label'

export type AcademiaHeader = {
  tournamentName: string
  etapaNumber: number
  year: number
  categoryName: string
  startDate: Date | null
}

// Meses en español → índice 0-based, para derivar un startDate aproximado del label.
const MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}

function cellAt(rows: string[][], r: number, c: number): string {
  return (rows[r]?.[c] ?? '').trim()
}

// ¿La celda es un nombre real (no vacío, no basura de edición tipo "." sola)?
function isName(s: string): boolean {
  const t = s.trim()
  return t.length > 0 && /[a-záéíóúñ]/i.test(t)
}

// Correcciones de apellidos mal escritos en la planilla de La Academia (carga manual, con
// typos). Se aplican al leer el nombre crudo, así la corrección queda en el dato y sobrevive
// a cada sync. Palabra completa, case-insensitive; preserva el resto ("R. Carvallo" → "R. Carvalho").
const NAME_FIXES: { from: RegExp; to: string }[] = [
  { from: /\bCarvallo\b/gi, to: 'Carvalho' },
]

function fixName(raw: string): string {
  return NAME_FIXES.reduce((s, { from, to }) => s.replace(from, to), raw)
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tildes/diacríticos
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

function nextPow2(n: number): number {
  if (n <= 1) return 1
  let p = 1
  while (p < n) p *= 2
  return p
}

// Clasifica el string crudo de la celda de score en outcome + score legible.
function classifyScore(raw: string): { score?: string; outcome: MatchOutcome } {
  const s = raw.trim()
  if (!s) return { outcome: 'normal' }
  if (/w\.?\s*o\.?/i.test(s)) return { outcome: 'walkover' } // "Wo." / "W.O."
  if (/ret\.?/i.test(s)) {
    const partial = s.replace(/ret\.?/i, '').trim()
    return { score: partial || undefined, outcome: 'retiro' }
  }
  return { score: s, outcome: 'normal' }
}

// Decide qué lado ganó por POSICIÓN: matchea el nombre del ganador (con typos) al
// más cercano de los dos jugadores (Levenshtein sobre texto normalizado).
function assignWinner(rawWinner: string, p1?: BracketSlot, p2?: BracketSlot): 1 | 2 | undefined {
  if (!p1 && !p2) return undefined
  if (p1 && !p2) return 1
  if (!p1 && p2) return 2
  const w = normalize(rawWinner)
  const d1 = levenshtein(w, normalize(p1!.name))
  const d2 = levenshtein(w, normalize(p2!.name))
  return d1 <= d2 ? 1 : 2
}

// ---------- Header ----------

export function parseHeader(rows: string[][]): AcademiaHeader | null {
  const tournamentName = cellAt(rows, 0, 0)

  // Línea de etapa: primera fila cuyo primer campo matchea "ETAPA <n>".
  let etapaLine = ''
  for (const row of rows) {
    const first = (row[0] ?? '').trim()
    if (/^etapa\s+\d+/i.test(first)) {
      etapaLine = first
      break
    }
  }
  const etapaMatch = etapaLine.match(/etapa\s+(\d+)/i)
  if (!etapaMatch) return null
  const etapaNumber = Number(etapaMatch[1])

  // Año: del label de etapa, o del título del torneo como fallback.
  const yearMatch = etapaLine.match(/\b(20\d{2})\b/) ?? tournamentName.match(/\b(20\d{2})\b/)
  if (!yearMatch) return null
  const year = Number(yearMatch[1])

  // Categoría: fila cuyo primer campo arranca con "Categoría"; el nombre va en col B.
  let categoryName = ''
  for (const row of rows) {
    const first = (row[0] ?? '').trim()
    if (/^categor[ií]a/i.test(first)) {
      categoryName = (row[1] ?? '').trim()
      break
    }
  }

  // startDate aproximado: primer mes español del label + año (en UTC, determinista).
  let startDate: Date | null = null
  const monthMatch = normalize(etapaLine).match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/)
  if (monthMatch) {
    startDate = new Date(Date.UTC(year, MONTHS[monthMatch[1]], 1))
  }

  return { tournamentName, etapaNumber, year, categoryName, startDate }
}

export function academiaIdentity(year: number, etapaNumber: number): { identityKey: string; slug: string } {
  return {
    identityKey: `academia-mg:${year}-etapa-${etapaNumber}`,
    slug: `academia-mg-${year}-etapa-${etapaNumber}`,
  }
}

// ---------- Bracket ----------

type MatchBuild = NormalizedMatch & {
  winnerRow: number // fila donde se lee el ganador (geometría)
  winnerSlot?: BracketSlot // jugador que avanza (canónico, con seed) — propaga hacia arriba sin typos
}

// Detecta el formato y, si es bracket de eliminación, lo parsea. Devuelve null para
// round-robin (SERIE) o si no se reconoce un cuadro (F1 solo soporta bracket).
export function parseBracket(rows: string[][]): NormalizedBracket | null {
  // Fila de header del cuadro: primer campo == "Player".
  const headerRow = rows.findIndex((row) => (row[0] ?? '').trim().toLowerCase() === 'player')
  if (headerRow === -1) return null // sin header de bracket → round-robin u otro → null

  const dataStart = headerRow + 1

  // Entrantes (ronda 0): grilla regular de 2 filas por slot. slot i → fila dataStart+2i.
  // Seed en col0 (si es numérico), nombre en col1. Los play-ins (nombres sueltos en col0)
  // caen fuera de la grilla → su slot queda TBD; no se pierde la alineación del resto.
  const entrants: (BracketSlot | undefined)[] = []
  const seeds: (number | undefined)[] = [] // seed de cada slot (col0), aunque col1 esté vacío
  let maxSlot = -1
  for (let i = 0; dataStart + 2 * i < rows.length; i++) {
    const row = dataStart + 2 * i
    const seedRaw = cellAt(rows, row, 0)
    const nameRaw = fixName(cellAt(rows, row, 1))
    const seed = /^\d+$/.test(seedRaw) ? Number(seedRaw) : undefined
    seeds[i] = seed
    if (isName(nameRaw)) {
      entrants[i] = { name: nameRaw, ...(seed !== undefined ? { seed } : {}) }
      maxSlot = i
    } else {
      entrants[i] = undefined
      if (seed !== undefined) maxSlot = i // seed sin nombre: slot dentro del draw (bye)
    }
  }
  if (maxSlot < 1) return null // no parece un cuadro

  const drawSize = nextPow2(maxSlot + 1)
  const totalRounds = Math.round(Math.log2(drawSize))

  const rounds: NormalizedRound[] = []
  let prev: MatchBuild[] = []

  for (let r = 0; r < totalRounds; r++) {
    const matchCount = drawSize / 2 ** (r + 1)
    const winnerCol = 2 + r
    const matches: MatchBuild[] = []

    for (let j = 0; j < matchCount; j++) {
      let p1: BracketSlot | undefined
      let p2: BracketSlot | undefined
      let winnerRow: number

      if (r === 0) {
        p1 = entrants[2 * j]
        p2 = entrants[2 * j + 1]
        winnerRow = dataStart + 4 * j + 1 // punto medio entre filas 2j y 2j+1
      } else {
        const childA = prev[2 * j]
        const childB = prev[2 * j + 1]
        p1 = childA.winnerSlot
        p2 = childB.winnerSlot
        winnerRow = Math.floor((childA.winnerRow + childB.winnerRow) / 2)
      }

      const match: MatchBuild = { slot: j, p1, p2, status: 'pending', winnerRow }
      const rawWinner = fixName(cellAt(rows, winnerRow, winnerCol))

      // BYE en primera ronda: la planilla deja vacíos los dos casilleros de col1 y
      // escribe el jugador directo en la columna de la ronda siguiente. Lo mostramos
      // como tarjeta: el jugador toma el primer slot (con su seed) y el segundo es BYE.
      if (r === 0 && !p1 && !p2 && isName(rawWinner)) {
        const s1 = seeds[2 * j]
        const s2 = seeds[2 * j + 1]
        const player: BracketSlot = { name: rawWinner, ...(s1 !== undefined ? { seed: s1 } : {}) }
        const byeSlot: BracketSlot = { name: 'BYE', bye: true, ...(s2 !== undefined ? { seed: s2 } : {}) }
        match.p1 = player
        match.p2 = byeSlot
        match.status = 'bye'
        match.winner = 1
        match.winnerSlot = player // avanza a la ronda siguiente
        matches.push(match)
        continue
      }

      if (isName(rawWinner)) {
        match.status = 'played'
        const winner = assignWinner(rawWinner, p1, p2)
        match.winner = winner
        match.winnerSlot = winner === 1 ? p1 : winner === 2 ? p2 : undefined
        const { score, outcome } = classifyScore(cellAt(rows, winnerRow + 1, winnerCol))
        match.outcome = outcome
        if (score) match.score = score
      }

      matches.push(match)
    }

    rounds.push({
      index: r,
      label: roundLabel(matchCount),
      matches: matches.map(stripBuild),
    })
    prev = matches
  }

  return { format: 'bracket', drawSize, rounds }
}

// Quita los campos internos de armado (winnerRow/winnerSlot) del match expuesto.
function stripBuild(m: MatchBuild): NormalizedMatch {
  const match: NormalizedMatch = { slot: m.slot, status: m.status }
  if (m.p1) match.p1 = m.p1
  if (m.p2) match.p2 = m.p2
  if (m.winner) match.winner = m.winner
  if (m.score) match.score = m.score
  if (m.outcome) match.outcome = m.outcome
  return match
}

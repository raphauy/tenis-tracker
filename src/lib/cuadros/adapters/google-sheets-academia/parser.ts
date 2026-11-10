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

// ¿La celda parece el NOMBRE de un ganador (y no un score ni un token de desenlace)?
// Se usa al buscar el ganador de una ronda derivada en una ventana de filas: hay que
// distinguir el nombre del score de abajo. Los nombres del dominio nunca traen dígitos;
// "Wo."/"W.O." es token de walkover (tiene letras, pero no es un nombre).
function looksLikeName(s: string): boolean {
  const t = s.trim()
  return isName(t) && !/\d/.test(t) && !/^w\.?\s*o\.?$/i.test(t)
}

// Correcciones de apellidos mal escritos en la planilla de La Academia (carga manual, con
// typos). Se aplican al leer el nombre crudo, así la corrección queda en el dato y sobrevive
// a cada sync. Palabra completa, case-insensitive; preserva el resto ("R. Carvallo" → "R. Carvalho").
const NAME_FIXES: { from: RegExp; to: string }[] = [
  { from: /\bCarvallo\b/gi, to: 'Carvalho' },
  { from: /\bCarvahlo\b/gi, to: 'Carvalho' },
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

// El Masters cierra el año y se juega en noviembre, pero su hoja no trae fecha. Se le asigna
// el 1° de noviembre (UTC) para que el listado lo ordene arriba de las etapas del año.
export function mastersStartDate(year: number): Date {
  return new Date(Date.UTC(year, 10, 1))
}

export function mastersIdentity(year: number): { identityKey: string; slug: string } {
  return {
    identityKey: `academia-mg:${year}-masters`,
    slug: `academia-mg-${year}-masters`,
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
  return parseBracketGrid(rows, 'player')
}

// Parser posicional común a las hojas de etapa (header "Player") y a los bloques del Masters
// (header "Clasificados"). `skipBlankRows`: el Masters deja una fila en blanco entre el header
// y el primer entrante; se saltea hasta la primera fila con seed o nombre.
function parseBracketGrid(
  rows: string[][],
  headerLabel: string,
  skipBlankRows = false
): NormalizedBracket | null {
  // Fila de header del cuadro: primer campo == headerLabel.
  const headerRow = rows.findIndex((row) => (row[0] ?? '').trim().toLowerCase() === headerLabel)
  if (headerRow === -1) return null // sin header de bracket → round-robin u otro → null

  let dataStart = headerRow + 1
  if (skipBlankRows) {
    while (dataStart < rows.length && !cellAt(rows, dataStart, 0) && !cellAt(rows, dataStart, 1)) {
      dataStart++
    }
  }

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

      // Fila real del ganador. El punto medio geométrico asume una grilla perfecta, pero la
      // planilla es MANUAL: en rondas derivadas (r>0) el nombre del ganador suele quedar
      // corrido ±1-2 filas respecto del medio (así el nombre cae en la fila del score y el
      // match quedaba "pendiente" pese a estar cargado). Lo buscamos en una ventana chica del
      // MISMO winnerCol; los ganadores vecinos de esta ronda están ≥8 filas → sin colisión.
      // r=0 va anclado a la grilla de entrantes (no drifta): se lee directo.
      let nameRow = winnerRow
      if (r > 0) {
        for (const off of [0, -1, 1, -2, 2, -3, 3]) {
          const cand = winnerRow + off
          if (cand >= 0 && looksLikeName(cellAt(rows, cand, winnerCol))) {
            nameRow = cand
            break
          }
        }
      }
      match.winnerRow = nameRow // propaga la fila REAL hacia arriba: medios más fieles al layout
      const rawWinner = fixName(cellAt(rows, nameRow, winnerCol))

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
        const { score, outcome } = classifyScore(cellAt(rows, nameRow + 1, winnerCol))
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

// ---------- Masters ----------

// La hoja "Masters" trae VARIOS cuadros de 8 en una grilla de bloques (hoy 3 por fila). Cada
// bloque se ubica por CONTENIDO: una celda ancla "Torneo de Maestros - <rama> - Divisional X"
// con la fila "Clasificados | QF | SF | F | CAMPEON" debajo. Se recorta a una sub-grilla propia
// y se parsea con la misma geometría que una hoja de etapa.

export type MastersBlock = {
  categoryName: string // "Singles Caballeros - A"
  raw: string // CSV del bloque recortado (snapshot + hash por cuadro, no por hoja)
  bracket: NormalizedBracket
}

const MASTERS_ANCHOR = /^torneo de maestros\b/i
const MASTERS_BLOCK_WIDTH = 5 // Clasificados, QF, SF, F, CAMPEON

// "Torneo de Maestros - Singles Caballeros - Divisional A" → "Singles Caballeros - A"
// (sin "Divisional", así el label corto de la pill da "A" igual que en la etapa).
function mastersCategoryName(title: string): string {
  return title
    .trim()
    .replace(MASTERS_ANCHOR, '')
    .replace(/^[\s\-–—]+/, '')
    .replace(/\bdivisional\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((c) => (/[",\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\n')
}

// Devuelve los cuadros del Masters que tienen jugadores, en orden de lectura (por fila de
// bloques, de izquierda a derecha). [] si la hoja no es del Masters o está toda vacía.
export function parseMastersSheet(rows: string[][]): MastersBlock[] {
  const anchors: { r: number; c: number }[] = []
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (MASTERS_ANCHOR.test(cell.trim())) anchors.push({ r, c })
    })
  )

  const blocks: MastersBlock[] = []
  for (const { r, c } of anchors) {
    // El bloque llega hasta la fila anterior al siguiente ancla que cae DEBAJO de él (sus
    // columnas se solapan) o al fin de la hoja. Los bloques de al lado no lo cortan, aunque
    // sus títulos estén corridos una fila (la planilla es manual).
    const below = anchors.filter((a) => a.r > r && Math.abs(a.c - c) < MASTERS_BLOCK_WIDTH)
    const end = Math.min(...below.map((a) => a.r), rows.length)
    const grid: string[][] = []
    for (let i = r; i < end; i++) {
      grid.push(Array.from({ length: MASTERS_BLOCK_WIDTH }, (_, j) => rows[i]?.[c + j] ?? ''))
    }

    // Bloque sin jugadores (solo los números de clasificación): todavía no es un cuadro.
    // El header se ubica por contenido (puede haber filas en blanco entre título y header).
    const header = grid.findIndex((row) => row[0].trim().toLowerCase() === 'clasificados')
    if (header === -1) continue
    if (!grid.slice(header + 1).some((row) => row.slice(1).some(isName))) continue

    const categoryName = mastersCategoryName(rows[r][c])
    const bracket = parseBracketGrid(grid, 'clasificados', true)
    if (!categoryName || !bracket) continue
    blocks.push({ categoryName, raw: toCsv(grid), bracket })
  }
  return blocks
}

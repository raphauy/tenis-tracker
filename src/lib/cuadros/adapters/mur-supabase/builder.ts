// Reconstrucción PURA del cuadro de MUR (sin fetch, sin env, sin Prisma → testeable con
// fixtures). MUR (Supabase/PostgREST) da el bracket EXPLÍCITO: cada `match` trae su ronda,
// sus dos jugadores (por inscripción) y el ganador; `match_number` es global y secuencial
// por ronda, con el pairing estándar (ronda r+1 match j ← ronda r matches 2j, 2j+1). Acá
// solo lo mapeamos al cuadro normalizado común; las rondas se re-etiquetan por geometría.

import type {
  BracketSlot,
  NormalizedBracket,
  NormalizedMatch,
  NormalizedRound,
} from '@/lib/cuadros/types'
import { roundLabel } from '@/lib/cuadros/round-label'

// Filas crudas de MUR (solo los campos PII-safe que pedimos; ver el adapter).
export type MurMatch = {
  match_number: number
  round: string
  player1_id: string | null
  player2_id: string | null
  winner_id: string | null
  player1_score: string | null
  player2_score: string | null
  status: string // 'completed' | 'scheduled' | ...
}

export type MurRegistration = {
  id: string
  player_name: string
  seed_position: number | null
  player_id: string | null
}

const BYE: BracketSlot = { name: 'BYE', bye: true }

// Score de MUR: viene coma-separado y por jugador ("3-6, 6-4, 10-8"). Tomamos el lado del
// ganador y lo pasamos al formato común (sets separados por espacio) que ya renderea la UI.
function winnerScore(m: MurMatch, winner: 1 | 2): string | undefined {
  const raw = winner === 1 ? m.player1_score : m.player2_score
  const s = (raw ?? '').replace(/,\s*/g, ' ').trim()
  return s || undefined
}

type Built = NormalizedMatch & { p1Id: string | null; p2Id: string | null }

function strip(m: Built): NormalizedMatch {
  const match: NormalizedMatch = { slot: m.slot, status: m.status }
  if (m.p1) match.p1 = m.p1
  if (m.p2) match.p2 = m.p2
  if (m.winner) match.winner = m.winner
  if (m.score) match.score = m.score
  if (m.outcome) match.outcome = m.outcome
  return match
}

// Construye el cuadro normalizado a partir de los matches + inscripciones de una categoría
// MUR. Devuelve null si no hay matches (etapa en inscripción, sin draw aún).
export function buildBracket(matches: MurMatch[], registrations: MurRegistration[]): NormalizedBracket | null {
  if (matches.length === 0) return null

  // matches.playerN_id → registrations.id (NO a players.id). El nombre y la siembra salen
  // de la inscripción; player_id es la identidad global (sourceId, para futuro cross-link).
  const regById = new Map<string, MurRegistration>(registrations.map((r) => [r.id, r]))
  const slotFor = (regId: string | null): BracketSlot | undefined => {
    if (!regId) return undefined
    const r = regById.get(regId)
    if (!r) return undefined
    const slot: BracketSlot = { name: r.player_name.trim() }
    if (r.seed_position != null) slot.seed = r.seed_position
    if (r.player_id) slot.sourceId = r.player_id
    return slot
  }

  // Agrupar por ronda (string) y ordenar las rondas por su primer match_number.
  const byRound = new Map<string, MurMatch[]>()
  for (const m of matches) {
    const arr = byRound.get(m.round)
    if (arr) arr.push(m)
    else byRound.set(m.round, [m])
  }
  const firstNum = (name: string) => Math.min(...byRound.get(name)!.map((m) => m.match_number))
  const roundNames = [...byRound.keys()].sort((a, b) => firstNum(a) - firstNum(b))

  const builtRounds: Built[][] = roundNames.map((name, roundIndex) => {
    const ms = byRound.get(name)!.slice().sort((a, b) => a.match_number - b.match_number)
    return ms.map((m, slot): Built => {
      const p1 = slotFor(m.player1_id)
      const p2 = slotFor(m.player2_id)
      const match: Built = { slot, status: 'pending', p1Id: m.player1_id, p2Id: m.player2_id }
      if (p1) match.p1 = p1
      if (p2) match.p2 = p2

      // Bye REAL: solo en 1ª ronda (un sembrado pasa sin jugar) → rival BYE, el presente
      // avanza. En rondas superiores un slot vacío = la llave previa aún no se definió
      // (semi pendiente, dato faltante) → queda PENDIENTE con el slot en blanco, NO es bye.
      if (roundIndex === 0 && (!!p1) !== (!!p2)) {
        const presentIs1 = !!p1
        match.p1 = presentIs1 ? p1 : BYE
        match.p2 = presentIs1 ? BYE : p2
        match.status = 'bye'
        match.winner = presentIs1 ? 1 : 2
        return match
      }

      // Ganador EXPLÍCITO por id. Completado con ganador y sin score → walkover (MUR no
      // distingue retiro: queda 'normal' con el score parcial que haya).
      const winner: 1 | 2 | undefined =
        m.winner_id && m.winner_id === m.player1_id
          ? 1
          : m.winner_id && m.winner_id === m.player2_id
            ? 2
            : undefined
      if (m.status === 'completed' && winner) {
        match.status = 'played'
        match.winner = winner
        const score = winnerScore(m, winner)
        if (score) match.score = score
        else match.outcome = 'walkover'
      }
      return match
    })
  })

  // Healing del status flojo de MUR: a veces un match queda 'scheduled'/sin ganador aunque
  // su jugador ya avanzó. Si el jugador aparece en el slot padre de la ronda siguiente, ese
  // jugador ganó (sin score). Evita mostrar un partido "pendiente" cuyo ganador ya jugó arriba.
  for (let r = 0; r < builtRounds.length - 1; r++) {
    const next = builtRounds[r + 1]
    for (const m of builtRounds[r]) {
      if (m.status !== 'pending') continue
      const parent = next[Math.floor(m.slot / 2)]
      if (!parent) continue
      const advancedId = m.slot % 2 === 0 ? parent.p1Id : parent.p2Id
      if (!advancedId) continue
      if (advancedId === m.p1Id) {
        m.status = 'played'
        m.winner = 1
      } else if (advancedId === m.p2Id) {
        m.status = 'played'
        m.winner = 2
      }
    }
  }

  const rounds: NormalizedRound[] = builtRounds.map((ms, index) => ({
    index,
    label: roundLabel(ms.length),
    matches: ms.map(strip),
  }))

  return { format: 'bracket', drawSize: (builtRounds[0]?.length ?? 0) * 2, rounds }
}

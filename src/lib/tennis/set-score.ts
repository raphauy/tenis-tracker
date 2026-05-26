// Estructura del marcador por sets (lo que se guarda en Match.sets, que Prisma tipa como Json).
// Decisión cerrada (ver docs/context.md § Resultado): shape plano con flags, sin validar regla de tenis.

export type SetScore = {
  myGames: number
  oppGames: number
  // Presente solo si el set se definió en tie-break (7-6): desglose de puntos del tie-break.
  tiebreak?: { my: number; opp: number }
  // true si el set es un super tie-break (reemplaza al 3er set). myGames/oppGames hacen de puntos.
  isSuperTb?: true
}

function isFiniteInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

export function isSetScore(v: unknown): v is SetScore {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  if (!isFiniteInt(s.myGames) || !isFiniteInt(s.oppGames)) return false
  if (s.tiebreak !== undefined) {
    const tb = s.tiebreak as Record<string, unknown>
    if (typeof tb !== 'object' || tb === null) return false
    if (!isFiniteInt(tb.my) || !isFiniteInt(tb.opp)) return false
  }
  if (s.isSuperTb !== undefined && s.isSuperTb !== true) return false
  return true
}

// Castea con seguridad el Json de Prisma a SetScore[]. Devuelve null si no calza.
export function isSetScoreArray(v: unknown): v is SetScore[] {
  return Array.isArray(v) && v.every(isSetScore)
}

export function parseSets(v: unknown): SetScore[] | null {
  return isSetScoreArray(v) ? v : null
}

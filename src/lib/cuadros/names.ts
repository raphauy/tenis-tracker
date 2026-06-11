import { normalizeName } from '@/lib/text'
import type { NormalizedBracket } from './types'

// Claves normalizadas (nameKey) de todos los jugadores presentes en los cuadros dados,
// salteando byes. Sirve para saber si un favorito (guardado por nameKey) sigue figurando
// en algún cuadro: si su clave no está en este set, ya no aparece (renombrado o eliminado).
export function collectBracketNameKeys(brackets: NormalizedBracket[]): Set<string> {
  const keys = new Set<string>()
  for (const bracket of brackets) {
    for (const round of bracket.rounds) {
      for (const match of round.matches) {
        for (const slot of [match.p1, match.p2]) {
          if (!slot || slot.bye) continue
          const key = normalizeName(slot.name)
          if (key) keys.add(key)
        }
      }
    }
  }
  return keys
}

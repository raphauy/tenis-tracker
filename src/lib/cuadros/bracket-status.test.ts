import { describe, it, expect } from 'vitest'
import {
  bracketProgress,
  COMPLETION_FALLBACK_MS,
  isPastCompletionFallback,
} from './bracket-status'
import type { NormalizedBracket, NormalizedMatch } from './types'

function match(slot: number, partial: Partial<NormalizedMatch>): NormalizedMatch {
  return { slot, status: 'pending', ...partial }
}

// Cuadro de 4: semifinales + final.
function bracket(semis: NormalizedMatch[], final: NormalizedMatch): NormalizedBracket {
  return {
    format: 'bracket',
    drawSize: 4,
    rounds: [
      { index: 0, label: 'Semifinal', matches: semis },
      { index: 1, label: 'Final', matches: [final] },
    ],
  }
}

describe('bracketProgress', () => {
  it('final jugada → campeón (el slot ganador)', () => {
    const b = bracket(
      [match(0, { status: 'played' }), match(1, { status: 'played' })],
      match(0, {
        status: 'played',
        winner: 2,
        p1: { name: 'A. Pérez' },
        p2: { name: 'B. López' },
      })
    )
    expect(bracketProgress(b)).toEqual({ state: 'champion', championName: 'B. López' })
  })

  it('partidos jugados sin final → en curso en la ronda más avanzada', () => {
    const b = bracket(
      [match(0, { status: 'played' }), match(1, {})],
      match(0, {})
    )
    expect(bracketProgress(b)).toEqual({ state: 'in-progress', roundLabel: 'Semifinal' })
  })

  it('sin partidos jugados → not-started', () => {
    const b = bracket([match(0, {}), match(1, {})], match(0, {}))
    expect(bracketProgress(b)).toEqual({ state: 'not-started' })
  })
})

describe('isPastCompletionFallback', () => {
  const DAY = 24 * 60 * 60 * 1000
  const start = new Date('2026-10-02T00:00:00Z')
  const end = new Date('2026-10-31T00:00:00Z')

  it('con endDate cuenta desde el FIN: a inicio+31d un torneo de un mes sigue vivo', () => {
    const now = start.getTime() + 31 * DAY
    expect(isPastCompletionFallback({ startDate: start, endDate: end }, now)).toBe(false)
  })

  it('con endDate: vence pasado el margen desde el fin', () => {
    const now = end.getTime() + COMPLETION_FALLBACK_MS + DAY
    expect(isPastCompletionFallback({ startDate: start, endDate: end }, now)).toBe(true)
  })

  it('sin endDate cae al inicio', () => {
    const now = start.getTime() + 31 * DAY
    expect(isPastCompletionFallback({ startDate: start }, now)).toBe(true)
    expect(isPastCompletionFallback({ startDate: start, endDate: null }, now)).toBe(true)
  })

  it('sin ninguna fecha nunca vence', () => {
    expect(isPastCompletionFallback({ startDate: null, endDate: null })).toBe(false)
  })
})

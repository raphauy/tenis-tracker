import { describe, it, expect } from 'vitest'
import { bracketProgress } from './bracket-status'
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

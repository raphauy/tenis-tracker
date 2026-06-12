import { describe, expect, it } from 'vitest'
import { detectNewResults } from './detect-results'
import type { NormalizedBracket, NormalizedMatch } from './types'

// Helper: arma un NormalizedBracket asignando index secuencial a cada ronda.
function bracket(rounds: { label: string; matches: NormalizedMatch[] }[]): NormalizedBracket {
  return {
    format: 'bracket',
    drawSize: 2 ** Math.max(rounds.length, 1),
    rounds: rounds.map((r, index) => ({ index, label: r.label, matches: r.matches })),
  }
}

const player = (name: string): { name: string } => ({ name })
const bye = (): { name: string; bye: true } => ({ name: 'BYE', bye: true })

describe('detectNewResults', () => {
  it('dispara en la transición pending → played', () => {
    const old = bracket([
      { label: 'Final', matches: [{ slot: 0, p1: player('Ana'), p2: player('Bia'), status: 'pending' }] },
    ])
    const next = bracket([
      { label: 'Final', matches: [{ slot: 0, p1: player('Ana'), p2: player('Bia'), winner: 1, score: '6-4 6-3', status: 'played' }] },
    ])
    const res = detectNewResults(old, next)
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ winnerName: 'Ana', loserName: 'Bia', isFinal: true, score: '6-4 6-3', isWalkover: false })
  })

  it('marca isWalkover en un W.O. (sin marcador) para que el copy muestre "W.O."', () => {
    const old = bracket([
      { label: '32avos', matches: [{ slot: 0, p1: player('Ana'), p2: player('Bia'), status: 'pending' }] },
      { label: '16avos', matches: [{ slot: 0, status: 'pending' }] },
    ])
    const next = bracket([
      { label: '32avos', matches: [{ slot: 0, p1: player('Ana'), p2: player('Bia'), winner: 1, outcome: 'walkover', status: 'played' }] },
      { label: '16avos', matches: [{ slot: 0, status: 'pending' }] },
    ])
    const res = detectNewResults(old, next)
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ winnerName: 'Ana', isWalkover: true, score: null })
  })

  it('no re-dispara un partido que ya estaba jugado (corrección posterior)', () => {
    const played: NormalizedMatch = { slot: 0, p1: player('Ana'), p2: player('Bia'), winner: 1, score: '6-4 6-3', status: 'played' }
    const old = bracket([{ label: 'Final', matches: [played] }])
    // misma posición, ya jugada, aunque cambie el score
    const next = bracket([{ label: 'Final', matches: [{ ...played, score: '7-5 6-3' }] }])
    expect(detectNewResults(old, next)).toHaveLength(0)
  })

  it('marca isFinal sólo en la última ronda y da el siguiente label en las previas', () => {
    const old = bracket([
      { label: 'Semifinal', matches: [{ slot: 0, p1: player('Ana'), p2: player('Bia'), status: 'pending' }] },
      { label: 'Final', matches: [{ slot: 0, status: 'pending' }] },
    ])
    const next = bracket([
      { label: 'Semifinal', matches: [{ slot: 0, p1: player('Ana'), p2: player('Bia'), winner: 1, score: '6-1 6-2', status: 'played' }] },
      { label: 'Final', matches: [{ slot: 0, status: 'pending' }] },
    ])
    const res = detectNewResults(old, next)
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ winnerName: 'Ana', isFinal: false, nextRoundLabel: 'Final', roundLabel: 'Semifinal' })
  })

  it('ignora partidos con status bye', () => {
    const old = bracket([{ label: 'Octavos', matches: [{ slot: 0, p1: player('Ana'), p2: bye(), status: 'bye' }] }])
    const next = bracket([{ label: 'Octavos', matches: [{ slot: 0, p1: player('Ana'), p2: bye(), status: 'bye' }] }])
    expect(detectNewResults(old, next)).toHaveLength(0)
  })

  it('da loserName null si el rival es un BYE en un partido jugado (defensivo)', () => {
    const old = bracket([{ label: 'Final', matches: [{ slot: 0, p1: player('Ana'), p2: bye(), status: 'pending' }] }])
    const next = bracket([{ label: 'Final', matches: [{ slot: 0, p1: player('Ana'), p2: bye(), winner: 1, status: 'played' }] }])
    const res = detectNewResults(old, next)
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ winnerName: 'Ana', loserName: null })
  })

  it('expone ambos nombres (winner por posición) para el cruce con favoritos', () => {
    const old = bracket([{ label: 'Cuartos', matches: [{ slot: 0, p1: player('Ana'), p2: player('Bia'), status: 'pending' }] }])
    const next = bracket([{ label: 'Cuartos', matches: [{ slot: 0, p1: player('Ana'), p2: player('Bia'), winner: 2, status: 'played' }] }])
    const res = detectNewResults(old, next)
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ winnerName: 'Bia', loserName: 'Ana' })
  })

  it('detecta como nuevo si la ronda no existía en el snapshot viejo', () => {
    const old = bracket([
      { label: 'Semifinal', matches: [{ slot: 0, p1: player('Ana'), p2: player('Bia'), status: 'pending' }] },
    ])
    const next = bracket([
      { label: 'Semifinal', matches: [{ slot: 0, p1: player('Ana'), p2: player('Bia'), winner: 1, status: 'played' }] },
      { label: 'Final', matches: [{ slot: 0, p1: player('Ana'), p2: player('Cyn'), winner: 1, status: 'played' }] },
    ])
    const res = detectNewResults(old, next)
    expect(res).toHaveLength(2)
    expect(res.find((r) => r.isFinal)).toMatchObject({ winnerName: 'Ana', loserName: 'Cyn', isFinal: true })
    expect(res.find((r) => !r.isFinal)).toMatchObject({ winnerName: 'Ana', nextRoundLabel: 'Final' })
  })
})

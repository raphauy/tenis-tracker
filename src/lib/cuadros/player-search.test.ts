import { describe, it, expect } from 'vitest'
import { isSearchableQuery, orientScore, searchPlayers, type SearchSource } from './player-search'
import type { NormalizedMatch } from './types'

function match(slot: number, partial: Partial<NormalizedMatch>): NormalizedMatch {
  return { slot, status: 'pending', ...partial }
}

// Un cuadro de una sola ronda con los partidos dados.
function source(
  slug: string,
  startDate: string | null,
  matches: NormalizedMatch[],
  roundLabel = 'Final'
): SearchSource {
  return {
    tournamentName: `Torneo ${slug}`,
    tournamentSlug: slug,
    startDate,
    categoryName: 'A',
    categorySlug: 'a',
    bracket: {
      format: 'bracket',
      drawSize: matches.length * 2,
      rounds: [{ index: 0, label: roundLabel, matches }],
    },
  }
}

const played = (
  slot: number,
  p1: string,
  p2: string,
  winner: 1 | 2,
  extra: Partial<NormalizedMatch> = {}
) => match(slot, { status: 'played', p1: { name: p1 }, p2: { name: p2 }, winner, score: '6-2 6-4', ...extra })

describe('isSearchableQuery', () => {
  it('exige 2 letras después de normalizar', () => {
    expect(isSearchableQuery('a')).toBe(false)
    expect(isSearchableQuery(' . ')).toBe(false)
    expect(isSearchableQuery('ca')).toBe(true)
  })
})

describe('orientScore', () => {
  it('deja el marcador como viene si el jugador ganó o está pendiente', () => {
    expect(orientScore('6-2 6-4', true)).toBe('6-2 6-4')
    expect(orientScore('6-2 6-4', null)).toBe('6-2 6-4')
  })

  it('invierte cada set si el jugador perdió, conservando el sufijo', () => {
    expect(orientScore('6-7(5) 7-5 10-4', false)).toBe('7-6(5) 5-7 4-10')
  })
})

describe('searchPlayers', () => {
  it('no distingue tildes ni mayúsculas, en ninguno de los dos sentidos', () => {
    const sources = [source('t1', '2026-03-01', [played(0, 'Martín Núñez', 'Bruno Braga', 1)])]
    expect(searchPlayers(sources, 'nunez').players.map((p) => p.name)).toEqual(['Martín Núñez'])
    expect(searchPlayers(sources, 'MARTÍN').players.map((p) => p.name)).toEqual(['Martín Núñez'])
    expect(searchPlayers(sources, 'brága').players.map((p) => p.name)).toEqual(['Bruno Braga'])
  })

  it('todas las palabras deben estar en el nombre, en cualquier orden', () => {
    const sources = [
      source('t1', '2026-03-01', [
        played(0, 'Juan Camou', 'Pedro Camacho', 1),
        played(1, 'Juan Pérez', 'Luis Díaz', 1),
      ]),
    ]
    expect(searchPlayers(sources, 'cam').players.map((p) => p.name)).toEqual([
      'Juan Camou',
      'Pedro Camacho',
    ])
    expect(searchPlayers(sources, 'cam ju').players.map((p) => p.name)).toEqual(['Juan Camou'])
  })

  it('lista los partidos más recientes primero y con el resultado desde el jugador', () => {
    const sources = [
      source('viejo', '2026-01-01', [played(0, 'Juan Camou', 'Luis Díaz', 2)]),
      source('nuevo', '2026-06-01', [played(0, 'Ana Ruiz', 'Juan Camou', 2)]),
    ]
    const [player] = searchPlayers(sources, 'camou').players
    expect(player.matches.map((m) => [m.tournamentSlug, m.opponentName, m.won])).toEqual([
      ['nuevo', 'Ana Ruiz', true],
      ['viejo', 'Luis Díaz', false],
    ])
    expect([player.wins, player.losses]).toEqual([1, 1])
  })

  it('arma el enfrentamiento solo contra rivales repetidos', () => {
    const sources = [
      source('t1', '2026-01-01', [played(0, 'Juan Camou', 'Bruno Braga', 1)]),
      source('t2', '2026-02-01', [played(0, 'Bruno Braga', 'Juan Camou', 1)]),
      source('t3', '2026-03-01', [played(0, 'Juan Camou', 'Luis Díaz', 1)]),
    ]
    const [player] = searchPlayers(sources, 'camou').players
    expect(player.matches.map((m) => [m.opponentName, m.h2h])).toEqual([
      ['Luis Díaz', undefined],
      ['Bruno Braga', { total: 2, wins: 1, losses: 1 }],
      ['Bruno Braga', { total: 2, wins: 1, losses: 1 }],
    ])
  })

  it('un rival llamado como una propiedad del prototipo no inventa enfrentamientos', () => {
    const sources = [source('t1', '2026-01-01', [played(0, 'Juan Camou', 'Constructor', 1)])]
    const [player] = searchPlayers(sources, 'camou').players
    expect(player.matches[0].h2h).toBeUndefined()
  })

  it('dos torneos homónimos con la misma fecha no se intercalan', () => {
    const twoRounds = (slug: string): SearchSource => ({
      ...source(slug, '2026-01-01', []),
      tournamentName: 'Grados',
      bracket: {
        format: 'bracket',
        drawSize: 4,
        rounds: [
          { index: 0, label: 'Semifinal', matches: [played(0, 'Juan Camou', 'Luis Díaz', 1)] },
          { index: 1, label: 'Final', matches: [played(0, 'Juan Camou', 'Ana Ruiz', 1)] },
        ],
      },
    })
    const [player] = searchPlayers([twoRounds('b'), twoRounds('a')], 'camou').players
    expect(player.matches.map((m) => `${m.tournamentSlug}:${m.roundLabel}`)).toEqual([
      'a:Final',
      'a:Semifinal',
      'b:Final',
      'b:Semifinal',
    ])
  })

  it('el W.O. y el pendiente cuentan como cruce pero no para el récord', () => {
    const sources = [
      source('t1', '2026-01-01', [played(0, 'Juan Camou', 'Bruno Braga', 1)]),
      source('t2', '2026-02-01', [
        played(0, 'Juan Camou', 'Bruno Braga', 1, { outcome: 'walkover', score: undefined }),
      ]),
      source('t3', '2026-03-01', [
        match(0, { p1: { name: 'Juan Camou' }, p2: { name: 'Bruno Braga' } }),
      ]),
    ]
    const [player] = searchPlayers(sources, 'camou').players
    expect(player.matches).toHaveLength(3)
    expect(player.matches[0]).toMatchObject({ status: 'pending', won: null })
    expect([player.wins, player.losses]).toEqual([1, 0])
    expect(player.matches[0].h2h).toEqual({ total: 3, wins: 1, losses: 0 })
  })

  it('ignora byes y slots sin rival', () => {
    const sources = [
      source('t1', '2026-01-01', [
        match(0, { status: 'bye', p1: { name: 'Juan Camou' }, p2: { name: 'BYE', bye: true } }),
        match(1, { p1: { name: 'Juan Camou' } }),
      ]),
    ]
    expect(searchPlayers(sources, 'camou')).toEqual({ players: [], total: 0 })
  })

  it('junta grafías que normalizan igual y respeta el tope', () => {
    const sources = [
      source('t1', '2026-01-01', [played(0, 'juan camou', 'Luis Díaz', 1)]),
      source('t2', '2026-02-01', [played(0, 'Juan Camou', 'Ana Díaz', 1)]),
    ]
    const camou = searchPlayers(sources, 'camou')
    expect(camou.players).toHaveLength(1)
    expect(camou.players[0].name).toBe('Juan Camou')
    expect(camou.players[0].matches).toHaveLength(2)

    const diaz = searchPlayers(sources, 'diaz', 1)
    expect(diaz.total).toBe(2)
    expect(diaz.players.map((p) => p.name)).toEqual(['Ana Díaz'])
  })
})

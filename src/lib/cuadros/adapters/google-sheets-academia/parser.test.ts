import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '@/lib/cuadros/csv'
import { academiaIdentity, parseBracket, parseHeader } from './parser'

function fixture(name: string): string[][] {
  const csv = readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')
  return parseCsv(csv)
}

const cabD = fixture('academia-cab-d-bracket.csv')
const cabC = fixture('academia-cab-c-bracket.csv')
const damas = fixture('academia-damas-serie.csv')

describe('parseHeader', () => {
  it('extrae etapa, año y categoría del bracket', () => {
    const h = parseHeader(cabD)
    expect(h).not.toBeNull()
    expect(h!.etapaNumber).toBe(3)
    expect(h!.year).toBe(2026)
    expect(h!.categoryName).toBe('SINGLES CABALLEROS - D')
    expect(h!.tournamentName).toContain('ACADEMIA MG 2026')
  })

  it('deriva startDate del primer mes del label (junio 2026, UTC)', () => {
    const h = parseHeader(cabD)
    expect(h!.startDate?.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })

  it('funciona también sobre una hoja de SERIE', () => {
    const h = parseHeader(damas)
    expect(h!.etapaNumber).toBe(3)
    expect(h!.categoryName).toBe('SINGLES DAMAS')
  })
})

describe('academiaIdentity', () => {
  it('compone identityKey por año+etapa y slug URL-safe', () => {
    expect(academiaIdentity(2026, 3)).toEqual({
      identityKey: 'academia-mg:2026-etapa-3',
      slug: 'academia-mg-2026-etapa-3',
    })
  })
})

describe('parseBracket — Cab D (draw 64)', () => {
  const bracket = parseBracket(cabD)!

  it('reconoce el bracket y su geometría', () => {
    expect(bracket).not.toBeNull()
    expect(bracket.format).toBe('bracket')
    expect(bracket.drawSize).toBe(64)
    expect(bracket.rounds).toHaveLength(6)
    expect(bracket.rounds.map((r) => r.label)).toEqual([
      '32avos', '16avos', 'Octavos', 'Cuartos', 'Semifinal', 'Final',
    ])
    expect(bracket.rounds[0].matches).toHaveLength(32)
  })

  it('walkover: Verdier vs Coore → gana Coore (Wo.), sin score', () => {
    const m = bracket.rounds[0].matches[3]
    expect(m.p1?.name).toBe('P. Verdier')
    expect(m.p2?.name).toBe('R. Coore')
    expect(m.status).toBe('played')
    expect(m.winner).toBe(2)
    expect(m.outcome).toBe('walkover')
    expect(m.score).toBeUndefined()
  })

  it('partido normal con super tie break: Kahn vs Patrone → gana Kahn', () => {
    const m = bracket.rounds[0].matches[4]
    expect(m.p1?.name).toBe('M. Kahn')
    expect(m.p2?.name).toBe('M. Patrone')
    expect(m.winner).toBe(1)
    expect(m.outcome).toBe('normal')
    expect(m.score).toBe('6-4 5-7 10-5')
  })

  it('ganador por POSICIÓN pese a typo: F. Echavarria (winner) ≈ F. Echevarria (slot 18)', () => {
    const m = bracket.rounds[0].matches[8]
    expect(m.p1?.name).toBe('D. Kan')
    expect(m.p2?.name).toBe('F. Echevarria')
    expect(m.winner).toBe(2)
    expect(m.score).toBe('6-4 6-2')
  })

  it('retiro: Paiva vs Gotlieb → gana Paiva, score parcial sin el token', () => {
    const m = bracket.rounds[0].matches[10]
    expect(m.p1?.name).toBe('A. Paiva')
    expect(m.p2?.name).toBe('W. Gotlieb')
    expect(m.winner).toBe(1)
    expect(m.outcome).toBe('retiro')
    expect(m.score).toBe('2-1')
  })

  it('seed se conserva en los entrantes', () => {
    const m = bracket.rounds[0].matches[3]
    expect(m.p1?.seed).toBe(7)
    expect(m.p2?.seed).toBe(8)
  })

  it('partido no jugado queda pendiente', () => {
    const m = bracket.rounds[0].matches[0]
    expect(m.p1?.name).toBe('B. Brun')
    expect(m.status).toBe('pending')
    expect(m.winner).toBeUndefined()
  })

  it('rondas superiores aún sin jugar = pendientes', () => {
    expect(bracket.rounds[5].matches).toHaveLength(1)
    expect(bracket.rounds[5].matches[0].status).toBe('pending')
  })
})

describe('parseBracket — Cab C (byes)', () => {
  const bracket = parseBracket(cabC)!

  it('el match real de la primera ronda se parsea (Briosso vs Nin, gana Nin)', () => {
    const m = bracket.rounds[0].matches[0]
    expect(m.p1?.name).toBe('D. Briosso')
    expect(m.p2?.name).toBe('E. Nin')
    expect(m.winner).toBe(2)
    expect(m.score).toBe('6-1 6-0')
  })

  it('bye en primera ronda: B. Lopez (seed 3) vs BYE (seed 4), sin resultado', () => {
    const m = bracket.rounds[0].matches[1]
    expect(m.status).toBe('bye')
    expect(m.p1).toEqual({ name: 'B. Lopez', seed: 3 })
    expect(m.p2?.bye).toBe(true)
    expect(m.p2?.seed).toBe(4)
    expect(m.score).toBeUndefined()
  })

  it('el jugador con bye avanza a 16avos (B. Lopez junto a E. Nin)', () => {
    const m = bracket.rounds[1].matches[0]
    const names = [m.p1?.name, m.p2?.name]
    expect(names).toContain('E. Nin')
    expect(names).toContain('B. Lopez')
  })
})

describe('parseBracket — formato SERIE (round-robin)', () => {
  it('devuelve null (no soportado en F1)', () => {
    expect(parseBracket(damas)).toBeNull()
  })
})

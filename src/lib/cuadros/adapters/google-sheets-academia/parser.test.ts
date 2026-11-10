import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '@/lib/cuadros/csv'
import {
  academiaIdentity,
  mastersIdentity,
  mastersStartDate,
  parseBracket,
  parseHeader,
  parseMastersSheet,
} from './parser'

function fixture(name: string): string[][] {
  const csv = readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')
  return parseCsv(csv)
}

const cabD = fixture('academia-cab-d-bracket.csv')
const cabDCuartos = fixture('academia-cab-d-cuartos-drift.csv')
const cabC = fixture('academia-cab-c-bracket.csv')
const damas = fixture('academia-damas-serie.csv')
const masters = fixture('academia-masters.csv')

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

// Snapshot real de prod (etapa 3, Cab D): en cuartos, la planilla manual escribió el nombre
// del ganador UNA fila arriba del punto medio geométrico → el nombre caía en la fila del score
// y el partido quedaba "pendiente" pese a estar cargado. El parser busca el ganador en una
// ventana de filas del winnerCol para tolerar ese corrimiento. Regresión de ese bug.
describe('parseBracket — Cab D cuartos con nombre corrido (drift)', () => {
  const bracket = parseBracket(cabDCuartos)!

  it('reconoce el cuarto R. Carvalho vs M. Meneses pese al corrimiento de fila', () => {
    const qf = bracket.rounds[3] // Cuartos
    const m = qf.matches[2]
    expect(m.p1?.name).toBe('R. Carvalho')
    expect(m.p2?.name).toBe('M. Meneses')
    expect(m.status).toBe('played')
    expect(m.winner).toBe(2) // gana M. Meneses
    expect(m.score).toBe('6-4 7-6')
    expect(m.outcome).toBe('normal')
  })

  it('el ganador de cuartos avanza a semifinal (M. Meneses)', () => {
    const sf = bracket.rounds[4] // Semifinal
    const names = sf.matches.flatMap((m) => [m.p1?.name, m.p2?.name])
    expect(names).toContain('M. Meneses')
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

// Hoja "Masters": UNA hoja con varios cuadros de 8 en grilla (3 bloques por fila). Cada
// bloque arranca en una celda "Torneo de Maestros - ..." con el header "Clasificados" debajo.
// Fixture real (nov 2026): 5 divisionales con jugadores, Damas A solo con los números, y
// todavía sin resultados cargados.
describe('parseMastersSheet', () => {
  const blocks = parseMastersSheet(masters)

  it('detecta los bloques con jugadores, en orden de lectura, y omite el vacío', () => {
    expect(blocks.map((b) => b.categoryName)).toEqual([
      'Singles Caballeros - A',
      'Singles Caballeros - B',
      'Singles Caballeros - C',
      'Singles Caballeros - D',
      'Singles Caballeros - E',
    ])
  })

  it('cada cuadro es de 8: Cuartos / Semifinal / Final', () => {
    for (const b of blocks) {
      expect(b.bracket.drawSize).toBe(8)
      expect(b.bracket.rounds.map((r) => r.label)).toEqual(['Cuartos', 'Semifinal', 'Final'])
      expect(b.bracket.rounds.map((r) => r.matches.length)).toEqual([4, 2, 1])
    }
  })

  it('cruces y seeds de cuartos (1–8, 5–4, 3–6, 7–2)', () => {
    const qf = blocks[0].bracket.rounds[0].matches
    expect(qf.map((m) => [m.p1, m.p2])).toEqual([
      [{ name: 'N. Fabregat', seed: 1 }, { name: 'J. Calvo', seed: 8 }],
      [{ name: 'V. Viscovick', seed: 5 }, { name: 'S. Naya', seed: 4 }],
      [{ name: 'C. Diena', seed: 3 }, { name: 'M. Privaz', seed: 6 }],
      [{ name: 'G. Cabrera', seed: 7 }, { name: 'S. Bianchi', seed: 2 }],
    ])
  })

  it('un bloque no se contamina con el vecino ni con el de abajo', () => {
    const names = (i: number) =>
      blocks[i].bracket.rounds[0].matches.flatMap((m) => [m.p1?.name, m.p2?.name])
    expect(names(1)).toEqual([
      'V. Viscovick', 'F. Portillo', 'D. Cleffi', 'M. Hernandez',
      'I. Reis', 'M. Canadell', 'L. Sanguinetti', 'G. Lamarque',
    ])
    expect(names(3)[0]).toBe('M. Meneses')
    expect(names(4)[7]).toBe('M. Kahn')
  })

  it('sin resultados cargados, todos los partidos quedan pendientes', () => {
    for (const b of blocks) {
      for (const r of b.bracket.rounds) {
        for (const m of r.matches) {
          expect(m.status).toBe('pending')
          expect(m.winner).toBeUndefined()
        }
      }
    }
  })

  it('corrige el apellido mal escrito en la planilla real (R. Carvahlo → R. Carvalho)', () => {
    expect(blocks[3].bracket.rounds[0].matches[2].p2).toEqual({ name: 'R. Carvalho', seed: 6 })
  })

  it('el crudo de cada bloque es solo su recorte (el hash de un bloque no depende de otro)', () => {
    expect(blocks[0].raw).toContain('N. Fabregat')
    expect(blocks[0].raw).not.toContain('V. Viscovick,,,,,,1') // nada del bloque B
    expect(blocks[0].raw).not.toContain('B. Lopez')
    expect(blocks[0].raw).not.toContain('M. Meneses')
    const changed = masters.map((row) => [...row])
    changed[4][9] = 'V. Viscovick' // resultado en la divisional B
    expect(parseMastersSheet(changed)[0].raw).toBe(blocks[0].raw)
  })

  // Variante SINTÉTICA: la hoja real aún no tiene resultados. Se asume la convención de las
  // hojas de etapa (ganador en el punto medio de la columna siguiente, score en la fila de
  // abajo). Contrastar con un fixture real cuando carguen el primer resultado.
  it('con un resultado cargado, el partido queda jugado y el ganador avanza a semifinal', () => {
    const played = masters.map((row) => [...row])
    played[4][2] = 'J. Calbo' // typo a propósito: matchea a J. Calvo
    played[5][2] = '6-3 6-4'
    played[8][2] = 'S. Naya'
    played[9][2] = 'Wo.'
    const a = parseMastersSheet(played)[0].bracket
    const [m0, m1] = a.rounds[0].matches
    expect(m0.status).toBe('played')
    expect(m0.winner).toBe(2)
    expect(m0.score).toBe('6-3 6-4')
    expect(m1.winner).toBe(2)
    expect(m1.outcome).toBe('walkover')
    const sf = a.rounds[1].matches[0]
    expect(sf.p1).toEqual({ name: 'J. Calvo', seed: 8 })
    expect(sf.p2).toEqual({ name: 'S. Naya', seed: 4 })
    expect(sf.status).toBe('pending')
  })

  it('una divisional aparece sola cuando le cargan jugadores', () => {
    const filled = masters.map((row) => [...row])
    const names = ['A. Uno', 'B. Dos', 'C. Tres', 'D. Cuatro', 'E. Cinco', 'F. Seis', 'G. Siete', 'H. Ocho']
    names.forEach((n, i) => { filled[23 + 2 * i][15] = n })
    const all = parseMastersSheet(filled)
    expect(all).toHaveLength(6)
    expect(all[5].categoryName).toBe('Singles Damas - A')
    expect(all[5].bracket.rounds[0].matches[0].p1).toEqual({ name: 'A. Uno', seed: 1 })
  })

  it('tolera títulos de bloques vecinos corridos una fila y una fila en blanco antes del header', () => {
    const shifted = masters.map((row) => [...row])
    shifted[1][14] = shifted[0][14] // título de la divisional C una fila más abajo
    shifted[0][14] = ''
    shifted[2][14] = 'Clasificados'
    shifted[1][15] = ''
    const all = parseMastersSheet(shifted)
    expect(all.map((b) => b.categoryName)).toEqual([
      'Singles Caballeros - A',
      'Singles Caballeros - B',
      'Singles Caballeros - C',
      'Singles Caballeros - D',
      'Singles Caballeros - E',
    ])
    expect(all[1].bracket.rounds[0].matches[0].p1?.name).toBe('V. Viscovick')
    expect(all[2].bracket.rounds[0].matches[0].p1).toEqual({ name: 'B. Lopez', seed: 1 })
  })

  it('una hoja de etapa no tiene bloques de Masters', () => {
    expect(parseMastersSheet(cabD)).toEqual([])
  })

  it('la hoja del Masters no es un cuadro de etapa', () => {
    expect(parseBracket(masters)).toBeNull()
  })
})

describe('mastersStartDate', () => {
  it('fecha el Masters en noviembre del año (UTC)', () => {
    expect(mastersStartDate(2026).toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })
})

describe('mastersIdentity', () => {
  it('compone identityKey y slug por año', () => {
    expect(mastersIdentity(2026)).toEqual({
      identityKey: 'academia-mg:2026-masters',
      slug: 'academia-mg-2026-masters',
    })
  })
})

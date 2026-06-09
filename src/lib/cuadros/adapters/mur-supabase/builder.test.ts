import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isBracketComplete } from '@/lib/cuadros/bracket-status'
import { buildBracket, type MurMatch, type MurRegistration } from './builder'

// Fixture real (categoría "Sexta" de los AUT Grados): draw de 32 con byes, status flojo
// (m21 quedó 'scheduled' aunque su jugador avanzó) y super tie break en la final.
const fixture = JSON.parse(
  readFileSync(new URL('./__fixtures__/sexta.json', import.meta.url), 'utf8')
) as { matches: MurMatch[]; registrations: MurRegistration[] }

const bracket = buildBracket(fixture.matches, fixture.registrations)!

describe('buildBracket — MUR Sexta (draw 32)', () => {
  it('reconoce la geometría y re-etiqueta las rondas por cantidad de partidos', () => {
    expect(bracket).not.toBeNull()
    expect(bracket.format).toBe('bracket')
    expect(bracket.drawSize).toBe(32)
    expect(bracket.rounds.map((r) => r.label)).toEqual([
      '16avos', 'Octavos', 'Cuartos', 'Semifinal', 'Final',
    ])
    expect(bracket.rounds[0].matches).toHaveLength(16)
  })

  it('bye: un solo jugador presente → rival BYE, sin resultado, el presente avanza', () => {
    // m1: p1 presente (Santiago Risso), p2 null.
    const a = bracket.rounds[0].matches[0]
    expect(a.status).toBe('bye')
    expect(a.p1?.name).toBe('Santiago Risso')
    expect(a.p2?.bye).toBe(true)
    expect(a.score).toBeUndefined()
    // m2: p1 null, p2 presente (Pablo Simon) → el BYE va de lado 1.
    const b = bracket.rounds[0].matches[1]
    expect(b.status).toBe('bye')
    expect(b.p1?.bye).toBe(true)
    expect(b.p2?.name).toBe('Pablo Simon')
    expect(b.winner).toBe(2)
  })

  it('partido normal: ganador por id + score del ganador normalizado (coma→espacio)', () => {
    // m3: gana 1f6944b7 (player1).
    const m = bracket.rounds[0].matches[2]
    expect(m.status).toBe('played')
    expect(m.winner).toBe(1)
    expect(m.score).toBe('2-6 6-3 10-5')
  })

  it('final con super tie break: gana Ignacio Reis, score 3-6 6-4 10-8', () => {
    const final = bracket.rounds[4].matches[0]
    expect(final.status).toBe('played')
    expect(final.p1?.name).toBe('Ignacio Reis') // 0c68e381 (player1) = ganador
    expect(final.winner).toBe(1)
    expect(final.score).toBe('3-6 6-4 10-8')
  })

  it('healing del status flojo: m21 quedó scheduled pero Juan Luketich avanzó a Cuartos', () => {
    // Ronda de 16, slot 4 (match_number 21): Javier Alvarez vs Juan Luketich, sin ganador
    // en MUR, pero 63b7962c (Luketich) está en Cuartos → se sana como ganador 2.
    const m = bracket.rounds[1].matches[4]
    expect(m.p2?.name).toBe('Juan Luketich')
    expect(m.status).toBe('played')
    expect(m.winner).toBe(2)
    expect(m.score).toBeUndefined() // sanado por propagación, sin marcador
  })

  it('isBracketComplete = true (la final está jugada)', () => {
    expect(isBracketComplete(bracket)).toBe(true)
  })
})

describe('buildBracket — sin matches', () => {
  it('devuelve null (etapa en inscripción, sin draw)', () => {
    expect(buildBracket([], fixture.registrations)).toBeNull()
  })
})

describe('buildBracket — slot vacío en ronda superior (semi pendiente)', () => {
  // Draw de 4: una semi jugada (A) y la otra pendiente → la final tiene a A esperando y el
  // otro lado vacío. NO es un bye (bye solo en 1ª ronda): debe quedar pendiente, en blanco.
  const regs: MurRegistration[] = [
    { id: 'a', player_name: 'A', seed_position: null, player_id: null },
    { id: 'b', player_name: 'B', seed_position: null, player_id: null },
    { id: 'c', player_name: 'C', seed_position: null, player_id: null },
    { id: 'd', player_name: 'D', seed_position: null, player_id: null },
  ]
  const matches: MurMatch[] = [
    { match_number: 1, round: 'Semifinal', player1_id: 'a', player2_id: 'b', winner_id: 'a', player1_score: '6-1, 6-2', player2_score: '1-6, 2-6', status: 'completed' },
    { match_number: 2, round: 'Semifinal', player1_id: 'c', player2_id: 'd', winner_id: null, player1_score: null, player2_score: null, status: 'scheduled' },
    { match_number: 3, round: 'Final', player1_id: 'a', player2_id: null, winner_id: null, player1_score: null, player2_score: null, status: 'scheduled' },
  ]
  const bracket = buildBracket(matches, regs)!

  it('la final con un solo finalista NO es bye: queda pendiente con el rival en blanco', () => {
    const final = bracket.rounds[1].matches[0]
    expect(final.status).toBe('pending')
    expect(final.p1?.name).toBe('A')
    expect(final.p1?.bye).toBeUndefined()
    expect(final.p2).toBeUndefined() // rival por definir (semi pendiente), no BYE
  })
})

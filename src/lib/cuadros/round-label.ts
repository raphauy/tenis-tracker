import type { NormalizedRound } from './types'

// Etiqueta de ronda por GEOMETRÍA (cantidad de partidos de la ronda), no por el header
// de la fuente. Compartida por todos los adapters (Academia, MUR) para que `/cuadros` se
// vea uniforme sin importar de dónde venga el cuadro.
export function roundLabel(matchCount: number): string {
  switch (matchCount) {
    case 1: return 'Final'
    case 2: return 'Semifinal'
    case 4: return 'Cuartos'
    case 8: return 'Octavos'
    case 16: return '16avos'
    case 32: return '32avos'
    case 64: return '64avos'
    case 128: return '128avos'
    default: return `Ronda de ${matchCount * 2}`
  }
}

// Etiqueta corta de ronda para el cuadro: acortamos solo "32avos"→R64 y "16avos"→R32
// (por cantidad de jugadores de la ronda), donde el nombre largo no entra. El resto
// (Octavos, Cuartos, Semifinal, Final) queda con su nombre. Se usa igual en el layout
// desktop (árbol) y mobile (pestañas) para ser coherentes.
export function shortRoundLabel(round: NormalizedRound): string {
  const players = round.matches.length * 2
  if (players === 64) return 'R64'
  if (players === 32) return 'R32'
  return round.label
}

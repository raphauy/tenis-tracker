import type { NormalizedRound } from './types'

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

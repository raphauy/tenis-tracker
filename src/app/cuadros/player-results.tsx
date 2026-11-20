import { searchPlayersInBrackets } from '@/services/external-bracket-service'
import { PlayerResultsList } from '@/components/cuadros/player-results-list'

// Resultados del buscador de jugador de /cuadros. RSC: busca en el server y delega el
// render interactivo (accordion + historial de enfrentamientos) al cliente.
export async function PlayerResults({ query }: { query: string }) {
  const { players, total } = await searchPlayersInBrackets(query)

  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        Ningún jugador coincide con “{query}”.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <PlayerResultsList players={players} />
      {total > players.length && (
        <p className="text-center text-xs text-muted-foreground">
          Mostrando {players.length} de {total} jugadores. Afiná la búsqueda para ver el resto.
        </p>
      )}
    </div>
  )
}

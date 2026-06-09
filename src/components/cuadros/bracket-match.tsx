'use client'

import { StarIcon } from 'lucide-react'
import type { BracketSlot, NormalizedMatch } from '@/lib/cuadros/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useFavorites } from './favorites-provider'

// El score crudo viene desde la perspectiva del GANADOR (sus games primero), con los
// sets separados por espacio ("6-7 7-5 10-4"). Lo mostramos separado por coma y con el
// set ganado por el ganador (X > Y) en negrita.
function ScoreSets({ score }: { score: string }) {
  const sets = score.trim().split(/\s+/)
  return (
    <span className="min-w-0 truncate tabular-nums">
      {sets.map((set, i) => {
        const m = set.match(/^(\d+)-(\d+)/)
        const won = m ? Number(m[1]) > Number(m[2]) : false
        return (
          <span key={i}>
            {i > 0 && ', '}
            <span className={cn(won && 'font-semibold text-foreground')}>{set}</span>
          </span>
        )
      })}
    </span>
  )
}

// Indicador de favorito. Relleno y visible cuando es favorito; si no, aparece al
// hover (desktop) y tenue en touch (mobile no tiene hover) como pista de que la fila
// es interactiva.
function StarIndicator({ fav }: { fav: boolean }) {
  return (
    <StarIcon
      aria-hidden
      className={cn(
        'size-3.5 shrink-0 transition',
        fav
          ? 'text-primary fill-current opacity-100'
          : 'text-muted-foreground opacity-0 group-hover/slot:opacity-100 [@media(hover:none)]:opacity-50'
      )}
    />
  )
}

// Una fila de jugador dentro de un partido. Resalta al ganador; los no-ganadores
// (en un partido jugado) se atenúan. Slot vacío = en blanco (bye/por definir).
// Si el jugador es favorito del viewer, la fila se resalta (bg dorado) con buen contraste.
// TODA la fila es el target del toggle (gran área de tap en mobile, sin estrellas que
// ensucien el cuadro). Logueado → togglea; anónimo → la estrella lleva a login.
function PlayerRow({
  player,
  won,
  decided,
}: {
  player?: BracketSlot
  won: boolean
  decided: boolean
}) {
  const { isFavorite, toggle, isAuthenticated, requestLogin } = useFavorites()
  const fav = !!player && !player.bye && isFavorite(player.name)

  // min-h-7 garantiza altura uniforme aunque el slot esté vacío (sin nombre) → las
  // tarjetas quedan parejas y los conectores del árbol siguen alineados.
  const rowBase = 'group/slot flex min-h-7 w-full items-center gap-1.5 py-1 pl-1.5 pr-1.5 text-left'
  const seed = (
    <span
      className={cn(
        'w-4 shrink-0 text-right text-[10px] tabular-nums',
        fav ? 'text-secondary-foreground/70' : 'text-muted-foreground'
      )}
    >
      {player?.seed ?? ''}
    </span>
  )
  const name = (
    <span
      className={cn(
        'min-w-0 flex-1 truncate text-sm',
        won && 'font-semibold',
        fav
          ? 'text-secondary-foreground'
          : won
            ? 'text-foreground'
            : decided
              ? 'text-muted-foreground'
              : undefined
      )}
    >
      {/* Slot vacío (bye/por definir): en blanco; la altura la garantiza min-h-7. */}
      {player ? player.name : ' '}
    </span>
  )

  // Slot vacío: no interactivo.
  if (!player) {
    return (
      <div className={rowBase}>
        {seed}
        {name}
      </div>
    )
  }

  // Slot de BYE: rival ausente; se muestra "BYE" tenue, no es favoritable.
  if (player.bye) {
    return (
      <div className={rowBase}>
        {seed}
        <span className="min-w-0 flex-1 truncate text-sm italic text-muted-foreground/70">BYE</span>
      </div>
    )
  }

  // Logueado: toda la fila togglea el favorito.
  if (isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => toggle(player.name)}
        aria-pressed={fav}
        aria-label={fav ? `Quitar a ${player.name} de favoritos` : `Marcar a ${player.name} como favorito`}
        className={cn(rowBase, 'cursor-pointer transition', fav ? 'bg-secondary' : 'hover:bg-foreground/5')}
      >
        {seed}
        {name}
        <StarIndicator fav={fav} />
      </button>
    )
  }

  // Anónimo: toda la fila abre el diálogo que invita a iniciar sesión (no togglea).
  return (
    <button
      type="button"
      onClick={requestLogin}
      aria-label="Iniciá sesión para marcar favoritos"
      className={cn(rowBase, 'cursor-pointer transition hover:bg-foreground/5')}
    >
      {seed}
      {name}
      <StarIndicator fav={false} />
    </button>
  )
}

// Tarjeta de un partido del cuadro. Compartida por el árbol desktop y el switcher
// mobile. Muestra ambos slots, score crudo, badges Wo./Ret. y "Pendiente".
export function BracketMatch({
  match,
  className,
}: {
  match: NormalizedMatch
  className?: string
}) {
  const played = match.status === 'played'
  // Sin ningún jugador = partido de una ronda aún no alcanzada (sus dos hijos siguen
  // pendientes). Se renderiza como tarjeta EN BLANCO (borde + filas vacías): sin nombres
  // ni "Pendiente", para que el árbol se vea completo y no queden solo las líneas.
  const empty = !match.p1 && !match.p2

  return (
    <div
      className={cn('overflow-hidden rounded-md border bg-card', className)}
      aria-hidden={empty || undefined}
    >
      <PlayerRow player={match.p1} won={played && match.winner === 1} decided={played} />
      <div className="border-t border-border/60" />
      <PlayerRow player={match.p2} won={played && match.winner === 2} decided={played} />
      <div className="flex min-h-6 items-center gap-1.5 border-t bg-muted/30 py-1 pl-1.5 pr-2 text-xs text-muted-foreground">
        {/* Spacer del ancho del seed: alinea el score/estado donde empiezan los nombres. */}
        <span className="w-4 shrink-0" />
        {empty ? (
          // Tarjeta en blanco (ronda aún no alcanzada): los dos slots están por definir.
          <span>Sin definir</span>
        ) : match.status === 'bye' ? (
          // Bye: sin resultado (fila vacía; el min-h-6 conserva el alto).
          null
        ) : !played ? (
          <span>Pendiente</span>
        ) : (
          <>
            {match.outcome === 'walkover' && (
              <Badge variant="outline" className="px-1 py-0 text-[10px] leading-tight">
                W.O.
              </Badge>
            )}
            {match.outcome === 'retiro' && (
              <Badge variant="outline" className="px-1 py-0 text-[10px] leading-tight">
                Ret.
              </Badge>
            )}
            {match.score ? (
              <ScoreSets score={match.score} />
            ) : (
              match.outcome === 'walkover' && <span>Sin jugar</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

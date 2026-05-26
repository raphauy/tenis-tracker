import { MatchType, MatchStatus, MatchSide } from '@prisma/client'
import { cn } from '@/lib/utils'
import { formatSets } from '@/lib/tennis/labels'
import type { SetScore } from '@/lib/tennis/set-score'

type Props = {
  type: MatchType
  status: MatchStatus
  winner: MatchSide | null
  sets: SetScore[] | null
}

// Chip Ganado/Perdido derivado del winner (desde la perspectiva del usuario).
export function WinLoss({ winner, className }: { winner: MatchSide | null; className?: string }) {
  if (!winner) return null
  const won = winner === MatchSide.ME
  return (
    <span
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-full text-xs font-bold',
        won ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600',
        className
      )}
      title={won ? 'Ganado' : 'Perdido'}
    >
      {won ? 'G' : 'P'}
    </span>
  )
}

// Solo el texto del desenlace (marcador, W.O., bye o programado), sin el chip W/L.
// Útil cuando el chip se ubica aparte (ej. listas donde el marcador va debajo del nombre).
export function ScoreText({
  type,
  status,
  sets,
  className,
}: {
  type: MatchType
  status: MatchStatus
  sets: SetScore[] | null
  className?: string
}) {
  if (type === MatchType.BYE) {
    return <span className={cn('text-sm text-muted-foreground', className)}>BYE</span>
  }
  if (status === MatchStatus.SCHEDULED) {
    return <span className={cn('text-sm text-muted-foreground', className)}>Programado</span>
  }

  const score = formatSets(sets)
  return (
    <span className={cn('font-mono text-sm tabular-nums', className)}>
      {type === MatchType.WALKOVER ? 'W.O.' : score}
      {type === MatchType.RETIRO && <span className="ml-1 text-muted-foreground">(ret.)</span>}
    </span>
  )
}

// Render del desenlace de un partido: marcador + W/L, o etiquetas de bye/W.O./programado.
export function ScoreDisplay({ type, status, winner, sets }: Props) {
  if (type === MatchType.BYE || status === MatchStatus.SCHEDULED) {
    return <ScoreText type={type} status={status} sets={sets} />
  }
  return (
    <span className="inline-flex items-center gap-2">
      <ScoreText type={type} status={status} sets={sets} />
      <WinLoss winner={winner} />
    </span>
  )
}

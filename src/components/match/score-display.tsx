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
function WinLoss({ winner }: { winner: MatchSide | null }) {
  if (!winner) return null
  const won = winner === MatchSide.ME
  return (
    <span
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-full text-xs font-bold',
        won ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'
      )}
      title={won ? 'Ganado' : 'Perdido'}
    >
      {won ? 'G' : 'P'}
    </span>
  )
}

// Render del desenlace de un partido: marcador + W/L, o etiquetas de bye/W.O./programado.
export function ScoreDisplay({ type, status, winner, sets }: Props) {
  if (type === MatchType.BYE) {
    return <span className="text-sm text-muted-foreground">BYE</span>
  }
  if (status === MatchStatus.SCHEDULED) {
    return <span className="text-sm text-muted-foreground">Programado</span>
  }

  const score = formatSets(sets)
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm tabular-nums">
        {type === MatchType.WALKOVER ? 'W.O.' : score}
        {type === MatchType.RETIRO && <span className="ml-1 text-muted-foreground">(ret.)</span>}
      </span>
      <WinLoss winner={winner} />
    </span>
  )
}

import { z } from 'zod'
import { Round, MatchStatus, MatchSide } from '@prisma/client'

// Un set del marcador. No valida regla de tenis (decisión cerrada), solo el shape.
export const setScoreSchema = z.object({
  myGames: z.number().int().min(0),
  oppGames: z.number().int().min(0),
  tiebreak: z
    .object({ my: z.number().int().min(0), opp: z.number().int().min(0) })
    .optional(),
  isSuperTb: z.literal(true).optional(),
})

const roundEnum = z.enum(Round)
const sideEnum = z.enum(MatchSide)
const setsArray = z.array(setScoreSchema).min(1, 'Cargá al menos un set')

// El payload del partido NO incluye entryId: la entry viaja aparte (la fija el wizard/detalle).

// BYE: sin rival ni marcador; status PLAYED (avanzó de ronda).
const byeMatch = z.object({
  round: roundEnum,
  type: z.literal('BYE'),
})

// WALKOVER: rival + dirección del ganador, sin marcador.
const walkoverMatch = z.object({
  round: roundEnum,
  type: z.literal('WALKOVER'),
  opponentId: z.string().min(1, 'El rival es obligatorio'),
  walkoverWinner: sideEnum,
})

// RETIRO: rival + quién se retiró + marcador parcial.
const retiroMatch = z.object({
  round: roundEnum,
  type: z.literal('RETIRO'),
  opponentId: z.string().min(1, 'El rival es obligatorio'),
  retiredBy: sideEnum,
  sets: setsArray,
})

// NORMAL: rival + estado (programado o jugado con marcador).
const normalMatch = z.object({
  round: roundEnum,
  type: z.literal('NORMAL'),
  opponentId: z.string().min(1, 'El rival es obligatorio'),
  status: z.enum(MatchStatus),
  sets: z.array(setScoreSchema).optional(),
})

// Regla: NORMAL jugado requiere al menos un set.
function requireSetsWhenPlayed(
  m: { type: string; status?: MatchStatus; sets?: unknown[] },
  ctx: z.RefinementCtx
) {
  if (
    m.type === 'NORMAL' &&
    m.status === MatchStatus.PLAYED &&
    (!m.sets || m.sets.length === 0)
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Cargá el marcador del partido jugado',
      path: ['sets'],
    })
  }
}

export const matchPayloadSchema = z
  .discriminatedUnion('type', [byeMatch, walkoverMatch, retiroMatch, normalMatch])
  .superRefine(requireSetsWhenPlayed)

export type MatchPayload = z.infer<typeof matchPayloadSchema>

// Para editar: mismo payload + id del partido.
const idObj = { id: z.string().min(1) }
export const updateMatchSchema = z
  .discriminatedUnion('type', [
    byeMatch.extend(idObj),
    walkoverMatch.extend(idObj),
    retiroMatch.extend(idObj),
    normalMatch.extend(idObj),
  ])
  .superRefine(requireSetsWhenPlayed)

export type UpdateMatchInput = z.infer<typeof updateMatchSchema>

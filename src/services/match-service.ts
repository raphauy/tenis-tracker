import { Prisma, MatchStatus, MatchSide, MatchType } from '@prisma/client'
import { prisma, withRetry } from '@/lib/prisma'
import { deriveMatchWinner } from '@/lib/tennis/derive'
import type { SetScore } from '@/lib/tennis/set-score'
import type { MatchPayload, UpdateMatchInput } from '@/lib/validations/match'

// Cliente o transacción: ambos exponen los modelos que usamos.
type Db = typeof prisma | Prisma.TransactionClient

// Campos normalizados del partido: estado, ganador y marcador derivados según el tipo.
type MatchScalars = {
  status: MatchStatus
  opponentId: string | null
  winner: MatchSide | null
  retiredBy: MatchSide | null
  sets: SetScore[] | null
}

// Normaliza un payload validado a los campos a persistir, derivando el ganador.
// Lanza si un partido NORMAL jugado no tiene un ganador determinable.
function normalizeMatch(input: MatchPayload | UpdateMatchInput): MatchScalars {
  switch (input.type) {
    case 'BYE':
      return { status: MatchStatus.PLAYED, opponentId: null, winner: null, retiredBy: null, sets: null }
    case 'WALKOVER':
      return {
        status: MatchStatus.PLAYED,
        opponentId: input.opponentId,
        winner: input.walkoverWinner,
        retiredBy: null,
        sets: null,
      }
    case 'RETIRO': {
      const winner = deriveMatchWinner({ type: MatchType.RETIRO, retiredBy: input.retiredBy })
      return {
        status: MatchStatus.PLAYED,
        opponentId: input.opponentId,
        winner,
        retiredBy: input.retiredBy,
        sets: input.sets,
      }
    }
    case 'NORMAL': {
      if (input.status === MatchStatus.SCHEDULED) {
        return { status: MatchStatus.SCHEDULED, opponentId: input.opponentId, winner: null, retiredBy: null, sets: null }
      }
      const winner = deriveMatchWinner({ type: MatchType.NORMAL, sets: input.sets })
      if (!winner) {
        throw new Error('Marcador incompleto: no se puede determinar el ganador')
      }
      return { status: MatchStatus.PLAYED, opponentId: input.opponentId, winner, retiredBy: null, sets: input.sets ?? null }
    }
  }
}

const setsForCreate = (sets: SetScore[] | null): Prisma.InputJsonValue | undefined =>
  sets ? (sets as unknown as Prisma.InputJsonValue) : undefined

const setsForUpdate = (sets: SetScore[] | null): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  sets ? (sets as unknown as Prisma.InputJsonValue) : Prisma.DbNull

// Verifica que la Participación sea del usuario. Lanza si no existe o no es suya.
async function assertEntryOwnership(db: Db, entryId: string, userId: string) {
  const entry = await db.entry.findUnique({ where: { id: entryId }, select: { userId: true } })
  if (!entry || entry.userId !== userId) throw new Error('Participación no encontrada')
}

// Una sola Match por (entryId, round). exceptId permite editar sin chocar consigo misma.
async function assertRoundFree(db: Db, entryId: string, round: MatchPayload['round'], exceptId?: string) {
  const existing = await db.match.findFirst({
    where: { entryId, round, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  })
  if (existing) throw new Error('Ya cargaste un partido para esa ronda')
}

// Crea un partido validando ownership y unicidad de ronda. Usable dentro de una transacción.
export async function createMatch(db: Db, entryId: string, payload: MatchPayload, userId: string) {
  await assertEntryOwnership(db, entryId, userId)
  await assertRoundFree(db, entryId, payload.round)
  const s = normalizeMatch(payload)
  return db.match.create({
    data: {
      entryId,
      round: payload.round,
      type: payload.type,
      status: s.status,
      opponentId: s.opponentId,
      winner: s.winner,
      retiredBy: s.retiredBy,
      sets: setsForCreate(s.sets),
    },
  })
}

export async function updateMatch(input: UpdateMatchInput, userId: string) {
  return withRetry(async () => {
    const current = await prisma.match.findUnique({
      where: { id: input.id },
      select: { entryId: true, entry: { select: { userId: true } } },
    })
    if (!current || current.entry.userId !== userId) throw new Error('Partido no encontrado')

    await assertRoundFree(prisma, current.entryId, input.round, input.id)
    const s = normalizeMatch(input)
    return prisma.match.update({
      where: { id: input.id },
      data: {
        round: input.round,
        type: input.type,
        status: s.status,
        opponentId: s.opponentId,
        winner: s.winner,
        retiredBy: s.retiredBy,
        sets: setsForUpdate(s.sets),
      },
    })
  })
}

export async function deleteMatch(id: string, userId: string) {
  return withRetry(async () => {
    const current = await prisma.match.findUnique({
      where: { id },
      select: { entry: { select: { userId: true } } },
    })
    if (!current || current.entry.userId !== userId) throw new Error('Partido no encontrado')
    await prisma.match.delete({ where: { id } })
  })
}

export async function getMatchById(id: string, userId: string) {
  return withRetry(async () => {
    const match = await prisma.match.findUnique({
      where: { id },
      include: { opponent: true, entry: { select: { userId: true } } },
    })
    if (!match || match.entry.userId !== userId) return null
    return match
  })
}

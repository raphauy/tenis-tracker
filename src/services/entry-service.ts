import type { Prisma } from '@prisma/client'
import { prisma, withRetry } from '@/lib/prisma'
import { createMatch } from '@/services/match-service'
import type { CreateEntryInput } from '@/lib/validations/entry'
import type { MatchPayload } from '@/lib/validations/match'

// Participación con todo lo que la timeline / detalle necesitan.
export type EntryWithRelations = Prisma.EntryGetPayload<{
  include: {
    tournament: { include: { venue: true } }
    category: true
    matches: { include: { opponent: true } }
  }
}>

const entryInclude = {
  tournament: { include: { venue: true } },
  category: true,
  matches: { include: { opponent: true } },
} satisfies Prisma.EntryInclude

// Timeline: torneo más reciente primero (por startDate; fallback al alta de la participación).
export async function getEntriesForUser(userId: string): Promise<EntryWithRelations[]> {
  return withRetry(() =>
    prisma.entry.findMany({
      where: { userId },
      include: entryInclude,
      orderBy: [{ tournament: { startDate: 'desc' } }, { createdAt: 'desc' }],
    })
  )
}

export async function getEntryById(id: string, userId: string): Promise<EntryWithRelations | null> {
  return withRetry(async () => {
    const entry = await prisma.entry.findUnique({ where: { id }, include: entryInclude })
    if (!entry || entry.userId !== userId) return null
    return entry
  })
}

// Reusa la Participación si ya existe (no rompe @@unique); si no, la crea.
export async function findOrCreateEntry(input: CreateEntryInput, userId: string) {
  return withRetry(() =>
    prisma.entry.upsert({
      where: {
        userId_tournamentId_categoryId: {
          userId,
          tournamentId: input.tournamentId,
          categoryId: input.categoryId,
        },
      },
      create: { userId, tournamentId: input.tournamentId, categoryId: input.categoryId },
      update: {},
    })
  )
}

// Alta atómica: crea/reusa la Participación y su primer partido en una transacción.
export async function createEntryWithMatch(
  input: CreateEntryInput,
  match: MatchPayload,
  userId: string
): Promise<{ entryId: string }> {
  return withRetry(() =>
    prisma.$transaction(async (tx) => {
      const entry = await tx.entry.upsert({
        where: {
          userId_tournamentId_categoryId: {
            userId,
            tournamentId: input.tournamentId,
            categoryId: input.categoryId,
          },
        },
        create: { userId, tournamentId: input.tournamentId, categoryId: input.categoryId },
        update: {},
      })
      await createMatch(tx, entry.id, match, userId)
      return { entryId: entry.id }
    })
  )
}

export async function deleteEntry(id: string, userId: string) {
  return withRetry(async () => {
    const entry = await prisma.entry.findUnique({ where: { id }, select: { userId: true } })
    if (!entry || entry.userId !== userId) throw new Error('Participación no encontrada')
    await prisma.entry.delete({ where: { id } })
  })
}

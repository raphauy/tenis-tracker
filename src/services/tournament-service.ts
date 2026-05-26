import { prisma, withRetry } from '@/lib/prisma'
import type { CurrentUser } from '@/lib/auth-helpers'
import type { CatalogOption } from '@/services/venue-service'

// El form pide mes+año; la action ya lo convirtió a startDate (día 1 del mes, UTC).
export type CreateTournamentInput = {
  name: string
  venueId: string
  startDate: Date
}

// Torneo pendiente para la cola del panel admin (incluye sede y fecha para poder editarlos).
export type TournamentPending = {
  id: string
  name: string
  venueId: string
  venueName: string
  startDate: Date | null
  createdAt: Date
  createdBy: { name: string | null; email: string }
  refCount: number
}

function catalogWhere(user: CurrentUser) {
  const notMerged = { mergedIntoId: null }
  if (user.role === 'SUPERADMIN') return notMerged
  return {
    ...notMerged,
    OR: [{ status: 'APPROVED' as const }, { createdById: user.id }],
  }
}

export async function getTournamentsForUser(user: CurrentUser) {
  return withRetry(() =>
    prisma.tournament.findMany({
      where: catalogWhere(user),
      include: { venue: true },
      orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
    })
  )
}

export async function createTournament(
  input: CreateTournamentInput,
  createdById: string
) {
  return withRetry(() =>
    prisma.tournament.create({
      data: {
        name: input.name,
        venueId: input.venueId,
        startDate: input.startDate,
        createdById,
      },
    })
  )
}

export async function getTournamentById(id: string) {
  return withRetry(() =>
    prisma.tournament.findUnique({ where: { id }, include: { venue: true } })
  )
}

// ---------- Moderación (superadmin) ----------

export async function getPendingTournaments(): Promise<TournamentPending[]> {
  const tournaments = await withRetry(() =>
    prisma.tournament.findMany({
      where: { status: 'PENDING', mergedIntoId: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        venueId: true,
        startDate: true,
        createdAt: true,
        venue: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
        _count: { select: { entries: true } },
      },
    })
  )
  return tournaments.map((t) => ({
    id: t.id,
    name: t.name,
    venueId: t.venueId,
    venueName: t.venue.name,
    startDate: t.startDate,
    createdAt: t.createdAt,
    createdBy: t.createdBy,
    refCount: t._count.entries,
  }))
}

export async function countPendingTournaments(): Promise<number> {
  return withRetry(() => prisma.tournament.count({ where: { status: 'PENDING', mergedIntoId: null } }))
}

export async function getApprovedTournaments(excludeId?: string): Promise<CatalogOption[]> {
  const tournaments = await withRetry(() =>
    prisma.tournament.findMany({
      where: { status: 'APPROVED', mergedIntoId: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, venue: { select: { name: true } } },
    })
  )
  // Etiqueta con la sede para desambiguar torneos homónimos en el selector de fusión.
  return tournaments.map((t) => ({ id: t.id, name: `${t.name} · ${t.venue.name}` }))
}

export async function approveTournament(id: string) {
  return withRetry(() => prisma.tournament.update({ where: { id }, data: { status: 'APPROVED' } }))
}

export async function updateTournament(
  id: string,
  data: { name: string; venueId: string; startDate: Date }
) {
  return withRetry(() =>
    prisma.tournament.update({
      where: { id },
      data: { name: data.name, venueId: data.venueId, startDate: data.startDate },
    })
  )
}

export async function deleteTournamentIfUnused(id: string) {
  return withRetry(async () => {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { _count: { select: { entries: true } } },
    })
    if (!tournament) throw new Error('Torneo no encontrado')
    if (tournament._count.entries > 0)
      throw new Error('No se puede eliminar: el torneo tiene participaciones. Fusionalo en su lugar')
    await prisma.tournament.delete({ where: { id } })
  })
}

export async function getTournamentMergeImpact(
  duplicateId: string
): Promise<{ entryCount: number; matchCount: number }> {
  const [entryCount, matchCount] = await Promise.all([
    withRetry(() => prisma.entry.count({ where: { tournamentId: duplicateId } })),
    withRetry(() => prisma.match.count({ where: { entry: { tournamentId: duplicateId } } })),
  ])
  return { entryCount, matchCount }
}

// Fusiona el torneo duplicado en el canónico: reapunta participaciones y lo archiva.
// Maneja la colisión del unique (userId, tournamentId, categoryId).
export async function mergeTournament(duplicateId: string, canonicalId: string) {
  if (duplicateId === canonicalId) throw new Error('No se puede fusionar un torneo consigo mismo')
  return withRetry(() =>
    prisma.$transaction(async (tx) => {
      const [dup, canonical] = await Promise.all([
        tx.tournament.findUnique({ where: { id: duplicateId }, select: { mergedIntoId: true } }),
        tx.tournament.findUnique({ where: { id: canonicalId }, select: { status: true, mergedIntoId: true } }),
      ])
      if (!dup || dup.mergedIntoId) throw new Error('El torneo a fusionar no existe o ya fue fusionado')
      if (!canonical || canonical.mergedIntoId || canonical.status !== 'APPROVED')
        throw new Error('El torneo canónico debe existir y estar aprobado')

      const dupEntries = await tx.entry.findMany({
        where: { tournamentId: duplicateId },
        select: { id: true, userId: true, categoryId: true },
      })

      for (const entry of dupEntries) {
        const collision = await tx.entry.findUnique({
          where: {
            userId_tournamentId_categoryId: {
              userId: entry.userId,
              tournamentId: canonicalId,
              categoryId: entry.categoryId,
            },
          },
          select: { id: true },
        })
        if (collision) {
          await tx.match.updateMany({ where: { entryId: entry.id }, data: { entryId: collision.id } })
          await tx.entry.delete({ where: { id: entry.id } })
        } else {
          await tx.entry.update({ where: { id: entry.id }, data: { tournamentId: canonicalId } })
        }
      }

      await tx.tournament.update({ where: { id: duplicateId }, data: { mergedIntoId: canonicalId } })
    })
  )
}

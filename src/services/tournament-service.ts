import { prisma, withRetry } from '@/lib/prisma'
import type { CurrentUser } from '@/lib/auth-helpers'

// El form pide mes+año; la action ya lo convirtió a startDate (día 1 del mes, UTC).
export type CreateTournamentInput = {
  name: string
  venueId: string
  startDate: Date
}

function catalogWhere(user: CurrentUser) {
  if (user.role === 'SUPERADMIN') return {}
  return { OR: [{ status: 'APPROVED' as const }, { createdById: user.id }] }
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

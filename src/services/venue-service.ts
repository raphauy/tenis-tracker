import { prisma, withRetry } from '@/lib/prisma'
import type { CreateVenueInput } from '@/lib/validations/venue'
import type { CurrentUser } from '@/lib/auth-helpers'

// Visibilidad de catálogo curado: aprobadas para todos + las propias (aunque estén PENDING).
// El SUPERADMIN ve todo.
function catalogWhere(user: CurrentUser) {
  if (user.role === 'SUPERADMIN') return {}
  return { OR: [{ status: 'APPROVED' as const }, { createdById: user.id }] }
}

export async function getVenuesForUser(user: CurrentUser) {
  return withRetry(() =>
    prisma.venue.findMany({
      where: catalogWhere(user),
      orderBy: { name: 'asc' },
    })
  )
}

export async function createVenue(input: CreateVenueInput, createdById: string) {
  return withRetry(() =>
    prisma.venue.create({ data: { name: input.name, createdById } })
  )
}

export async function getVenueById(id: string) {
  return withRetry(() => prisma.venue.findUnique({ where: { id } }))
}

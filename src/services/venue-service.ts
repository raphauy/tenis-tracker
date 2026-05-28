import { prisma, withRetry } from '@/lib/prisma'
import type { CreateVenueInput } from '@/lib/validations/venue'
import type { CurrentUser } from '@/lib/auth-helpers'

// Entrada de catálogo curado para la cola del panel admin.
// `createdBy.email` puede ser null desde Fase 2 (usuarios que entraron por WhatsApp
// y todavía no agregaron email).
export type CatalogPending = {
  id: string
  name: string
  createdAt: Date
  createdBy: { name: string | null; email: string | null }
  refCount: number
}

export type CatalogOption = { id: string; name: string }

// Visibilidad de catálogo curado: aprobadas para todos + las propias (aunque estén PENDING).
// Se excluyen siempre las fusionadas (archivadas). El SUPERADMIN ve todo (salvo archivadas).
function catalogWhere(user: CurrentUser) {
  const notMerged = { mergedIntoId: null }
  if (user.role === 'SUPERADMIN') return notMerged
  return {
    ...notMerged,
    OR: [{ status: 'APPROVED' as const }, { createdById: user.id }],
  }
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

// ---------- Moderación (superadmin) ----------

export async function getPendingVenues(): Promise<CatalogPending[]> {
  const venues = await withRetry(() =>
    prisma.venue.findMany({
      where: { status: 'PENDING', mergedIntoId: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
        _count: { select: { tournaments: true } },
      },
    })
  )
  return venues.map((v) => ({
    id: v.id,
    name: v.name,
    createdAt: v.createdAt,
    createdBy: v.createdBy,
    refCount: v._count.tournaments,
  }))
}

export async function countPendingVenues(): Promise<number> {
  return withRetry(() => prisma.venue.count({ where: { status: 'PENDING', mergedIntoId: null } }))
}

// Sedes aprobadas no archivadas: destinos válidos de una fusión (se excluye un id opcional).
export async function getApprovedVenues(excludeId?: string): Promise<CatalogOption[]> {
  return withRetry(() =>
    prisma.venue.findMany({
      where: { status: 'APPROVED', mergedIntoId: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
  )
}

export async function approveVenue(id: string) {
  return withRetry(() => prisma.venue.update({ where: { id }, data: { status: 'APPROVED' } }))
}

export async function updateVenue(id: string, name: string) {
  return withRetry(() => prisma.venue.update({ where: { id }, data: { name } }))
}

export async function deleteVenueIfUnused(id: string) {
  return withRetry(async () => {
    const venue = await prisma.venue.findUnique({
      where: { id },
      select: { _count: { select: { tournaments: true } } },
    })
    if (!venue) throw new Error('Sede no encontrada')
    if (venue._count.tournaments > 0)
      throw new Error('No se puede eliminar: la sede tiene torneos. Fusionala en su lugar')
    await prisma.venue.delete({ where: { id } })
  })
}

export async function getVenueMergeImpact(duplicateId: string): Promise<{ tournamentCount: number }> {
  const count = await withRetry(() => prisma.tournament.count({ where: { venueId: duplicateId } }))
  return { tournamentCount: count }
}

// Fusiona la sede duplicada en la canónica: reapunta sus torneos y la archiva.
export async function mergeVenue(duplicateId: string, canonicalId: string) {
  if (duplicateId === canonicalId) throw new Error('No se puede fusionar una sede consigo misma')
  return withRetry(() =>
    prisma.$transaction(async (tx) => {
      const [dup, canonical] = await Promise.all([
        tx.venue.findUnique({ where: { id: duplicateId }, select: { mergedIntoId: true } }),
        tx.venue.findUnique({ where: { id: canonicalId }, select: { status: true, mergedIntoId: true } }),
      ])
      if (!dup || dup.mergedIntoId) throw new Error('La sede a fusionar no existe o ya fue fusionada')
      if (!canonical || canonical.mergedIntoId || canonical.status !== 'APPROVED')
        throw new Error('La sede canónica debe existir y estar aprobada')

      await tx.tournament.updateMany({ where: { venueId: duplicateId }, data: { venueId: canonicalId } })
      await tx.venue.update({ where: { id: duplicateId }, data: { mergedIntoId: canonicalId } })
    })
  )
}

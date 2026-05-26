import { prisma, withRetry } from '@/lib/prisma'
import type { CreateCategoryInput } from '@/lib/validations/category'
import type { CurrentUser } from '@/lib/auth-helpers'
import type { CatalogPending, CatalogOption } from '@/services/venue-service'

function catalogWhere(user: CurrentUser) {
  const notMerged = { mergedIntoId: null }
  if (user.role === 'SUPERADMIN') return notMerged
  return {
    ...notMerged,
    OR: [{ status: 'APPROVED' as const }, { createdById: user.id }],
  }
}

export async function getCategoriesForUser(user: CurrentUser) {
  return withRetry(() =>
    prisma.category.findMany({
      where: catalogWhere(user),
      orderBy: { name: 'asc' },
    })
  )
}

export async function createCategory(
  input: CreateCategoryInput,
  createdById: string
) {
  return withRetry(() =>
    prisma.category.create({ data: { name: input.name, createdById } })
  )
}

// ---------- Moderación (superadmin) ----------

export async function getPendingCategories(): Promise<CatalogPending[]> {
  const categories = await withRetry(() =>
    prisma.category.findMany({
      where: { status: 'PENDING', mergedIntoId: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
        _count: { select: { entries: true } },
      },
    })
  )
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt,
    createdBy: c.createdBy,
    refCount: c._count.entries,
  }))
}

export async function countPendingCategories(): Promise<number> {
  return withRetry(() => prisma.category.count({ where: { status: 'PENDING', mergedIntoId: null } }))
}

export async function getApprovedCategories(excludeId?: string): Promise<CatalogOption[]> {
  return withRetry(() =>
    prisma.category.findMany({
      where: { status: 'APPROVED', mergedIntoId: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
  )
}

export async function approveCategory(id: string) {
  return withRetry(() => prisma.category.update({ where: { id }, data: { status: 'APPROVED' } }))
}

export async function updateCategory(id: string, name: string) {
  return withRetry(() => prisma.category.update({ where: { id }, data: { name } }))
}

export async function deleteCategoryIfUnused(id: string) {
  return withRetry(async () => {
    const category = await prisma.category.findUnique({
      where: { id },
      select: { _count: { select: { entries: true } } },
    })
    if (!category) throw new Error('Categoría no encontrada')
    if (category._count.entries > 0)
      throw new Error('No se puede eliminar: la categoría tiene participaciones. Fusionala en su lugar')
    await prisma.category.delete({ where: { id } })
  })
}

export async function getCategoryMergeImpact(
  duplicateId: string
): Promise<{ entryCount: number; matchCount: number }> {
  const [entryCount, matchCount] = await Promise.all([
    withRetry(() => prisma.entry.count({ where: { categoryId: duplicateId } })),
    withRetry(() => prisma.match.count({ where: { entry: { categoryId: duplicateId } } })),
  ])
  return { entryCount, matchCount }
}

// Fusiona la categoría duplicada en la canónica: reapunta participaciones y la archiva.
// Maneja la colisión del unique (userId, tournamentId, categoryId): si el usuario ya tiene
// una participación en ese torneo con la categoría canónica, mueve los partidos y borra la vacía.
export async function mergeCategory(duplicateId: string, canonicalId: string) {
  if (duplicateId === canonicalId) throw new Error('No se puede fusionar una categoría consigo misma')
  return withRetry(() =>
    prisma.$transaction(async (tx) => {
      const [dup, canonical] = await Promise.all([
        tx.category.findUnique({ where: { id: duplicateId }, select: { mergedIntoId: true } }),
        tx.category.findUnique({ where: { id: canonicalId }, select: { status: true, mergedIntoId: true } }),
      ])
      if (!dup || dup.mergedIntoId) throw new Error('La categoría a fusionar no existe o ya fue fusionada')
      if (!canonical || canonical.mergedIntoId || canonical.status !== 'APPROVED')
        throw new Error('La categoría canónica debe existir y estar aprobada')

      const dupEntries = await tx.entry.findMany({
        where: { categoryId: duplicateId },
        select: { id: true, userId: true, tournamentId: true },
      })

      for (const entry of dupEntries) {
        const collision = await tx.entry.findUnique({
          where: {
            userId_tournamentId_categoryId: {
              userId: entry.userId,
              tournamentId: entry.tournamentId,
              categoryId: canonicalId,
            },
          },
          select: { id: true },
        })
        if (collision) {
          // Mover los partidos a la participación canónica y borrar la duplicada vacía.
          await tx.match.updateMany({ where: { entryId: entry.id }, data: { entryId: collision.id } })
          await tx.entry.delete({ where: { id: entry.id } })
        } else {
          await tx.entry.update({ where: { id: entry.id }, data: { categoryId: canonicalId } })
        }
      }

      await tx.category.update({ where: { id: duplicateId }, data: { mergedIntoId: canonicalId } })
    })
  )
}

import { prisma, withRetry } from '@/lib/prisma'
import type { CreateCategoryInput } from '@/lib/validations/category'
import type { CurrentUser } from '@/lib/auth-helpers'

function catalogWhere(user: CurrentUser) {
  if (user.role === 'SUPERADMIN') return {}
  return { OR: [{ status: 'APPROVED' as const }, { createdById: user.id }] }
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

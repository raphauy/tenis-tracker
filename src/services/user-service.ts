import { prisma } from '@/lib/prisma'

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } })
}

// Datos mínimos para el control de acceso del proxy (sin exponer Prisma fuera de services).
export async function getUserAccessInfo(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { isActive: true, role: true },
  })
}

// Self-signup: crea el usuario (role USER) si no existe. Idempotente por email.
export async function upsertUserByEmail(email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  })
}

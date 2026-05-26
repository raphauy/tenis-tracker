import { prisma } from '@/lib/prisma'
import type { Visibility } from '@prisma/client'

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } })
}

// Datos mínimos para el control de acceso del proxy (sin exponer Prisma fuera de services).
// Incluye slug: el proxy decide onboarding vs perfil sin segunda query.
export async function getUserAccessInfo(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { isActive: true, role: true, slug: true },
  })
}

// Dueño del Perfil resuelto por slug. NUNCA expone email (perfil público).
export async function getProfileBySlug(slug: string) {
  return prisma.user.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { id: true, name: true, slug: true, visibility: true, image: true, role: true },
  })
}

// Datos del visitante logueado para alimentar su avatar dropdown (incl. en perfiles ajenos).
export async function getViewerChrome(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, slug: true, image: true, role: true },
  })
}

export async function isSlugTaken(slug: string): Promise<boolean> {
  const found = await prisma.user.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { id: true },
  })
  return found !== null
}

// Onboarding: fija nombre + slug. Deja propagar P2002 (race del live-check); la action lo catchea.
export async function setUserSlugAndName(id: string, name: string, slug: string) {
  return prisma.user.update({
    where: { id },
    data: { name, slug: slug.toLowerCase() },
  })
}

// Ajustes: NO permite cambiar el slug (fijo tras onboarding).
export async function updateUserProfile(
  id: string,
  data: { name?: string; image?: string | null; visibility?: Visibility }
) {
  return prisma.user.update({ where: { id }, data })
}

// Self-signup: crea el usuario (role USER) si no existe. Idempotente por email.
export async function upsertUserByEmail(email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  })
}

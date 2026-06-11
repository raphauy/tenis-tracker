import { prisma } from '@/lib/prisma'
import type { Visibility } from '@prisma/client'

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

// Identidad primaria desde Fase 2 (Magic-link inverso por WhatsApp).
export async function getUserByPhone(phone: string) {
  return prisma.user.findUnique({ where: { phone } })
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

// Listado completo para /admin/usuarios. Expone phone/email: SOLO consumo del superadmin.
export type UserAdmin = Awaited<ReturnType<typeof getUsersAdmin>>[number]

export async function getUsersAdmin() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      phoneVerifiedAt: true,
      email: true,
      emailVerifiedAt: true,
      image: true,
      role: true,
      isActive: true,
      visibility: true,
      notifyEmailMode: true,
      notifyWhatsappMode: true,
      createdAt: true,
      _count: { select: { entries: true, favoritePlayers: true } },
    },
  })
  return users.map(({ _count, ...u }) => ({
    ...u,
    entryCount: _count.entries,
    favoriteCount: _count.favoritePlayers,
  }))
}

// Emails de los superadmin activos: destinatarios de la notificación de curado.
// Desde Fase 2 el email es opcional; filtramos los que no lo tienen seteado.
export async function getSuperadminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'SUPERADMIN', isActive: true, email: { not: null } },
    select: { email: true },
  })
  return admins.flatMap((a) => (a.email ? [a.email] : []))
}

// Perfiles públicos activos con slug, para el sitemap.
// Excluye PRIVATE (no debe aparecer en buscadores aunque vivan en URL conocida).
export async function getPublicProfilesForSitemap() {
  return prisma.user.findMany({
    where: { isActive: true, visibility: 'PUBLIC', slug: { not: null } },
    select: { slug: true, updatedAt: true },
  })
}

// Self-signup por WhatsApp (Fase 2): identidad primaria = phone. Si el phone no existía,
// se crea User(phone, phoneVerifiedAt=now). Idempotente por phone.
// Sin email: el usuario lo agrega después en el onboarding/banner (opcional).
// `name`: nombre de perfil de WhatsApp (contact_name del webhook), usado solo al crear para
// pre-llenar el onboarding. NO se pisa en logins recurrentes (update vacío).
export async function upsertUserByPhone(phone: string, name?: string | null) {
  const now = new Date()
  const cleanName = name?.trim().slice(0, 100) || null
  return prisma.user.upsert({
    where: { phone },
    update: {}, // si ya existe, no toca nada (login normal)
    create: { phone, phoneVerifiedAt: now, name: cleanName },
  })
}

// Setea/actualiza el email del usuario sin verificarlo (verify diferido vía banner).
// Permite también poner null para limpiarlo.
// Si el email no cambia, no toca emailVerifiedAt (evita invalidar verificaciones previas
// cuando el caller llama defensivamente con el mismo valor).
export async function setUserEmail(id: string, email: string | null) {
  const current = await prisma.user.findUnique({ where: { id }, select: { email: true } })
  if (current && current.email === email) return current
  return prisma.user.update({
    where: { id },
    data: { email, emailVerifiedAt: null },
  })
}

// Marca el email como verificado tras OTP exitoso por Resend.
export async function setEmailVerified(id: string) {
  return prisma.user.update({
    where: { id },
    data: { emailVerifiedAt: new Date() },
  })
}

// Estado del email del owner para decidir si mostrar el banner persistente.
export async function getEmailStatus(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { email: true, emailVerifiedAt: true },
  })
}

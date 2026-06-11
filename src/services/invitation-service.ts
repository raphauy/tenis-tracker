import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

// Invitaciones por email a potenciales usuarios (admin). El registro real es por
// WhatsApp (magic-link inverso), así que la invitación NO crea cuenta: traza el
// funnel invitado → registrado. "Aceptada" la marca el hook del onboarding (cookie
// del link) o la visita al link con sesión activa.

export const INVITATION_EXPIRES_DAYS = 7

function newToken(): string {
  return randomBytes(24).toString('base64url')
}

function expiryFromNow(): Date {
  return new Date(Date.now() + INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
}

const invitationInclude = {
  invitedBy: { select: { id: true, name: true } },
  acceptedUser: { select: { id: true, name: true, slug: true } },
} as const

export type InvitationAdmin = NonNullable<Awaited<ReturnType<typeof getInvitationById>>>

export async function getInvitationById(id: string) {
  return prisma.invitation.findUnique({ where: { id }, include: invitationInclude })
}

export async function getInvitationByToken(token: string) {
  return prisma.invitation.findUnique({ where: { token }, include: invitationInclude })
}

// Todas las invitaciones (pendientes, aceptadas y expiradas), más recientes primero.
export async function getInvitationsAdmin() {
  return prisma.invitation.findMany({
    include: invitationInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export async function createInvitation(input: {
  email: string
  name: string
  invitedById: string
}) {
  const { email, name, invitedById } = input

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) throw new Error('Ya hay un usuario registrado con ese email')

  const pending = await prisma.invitation.findFirst({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
  })
  if (pending) throw new Error('Ya hay una invitación pendiente para ese email')

  return prisma.invitation.create({
    data: { email, name, token: newToken(), expiresAt: expiryFromNow(), invitedById },
    include: invitationInclude,
  })
}

// Reenvío en dos pasos para no invalidar el link anterior si el email falla: `prepareResend`
// valida y genera el nuevo token + expiración SIN tocar la DB; el caller manda el email y, solo
// si salió bien, llama `commitResend`, que recién ahí rota el token y extiende la expiración.
export async function prepareResend(id: string) {
  const invitation = await prisma.invitation.findUnique({ where: { id }, include: invitationInclude })
  if (!invitation) throw new Error('Invitación no encontrada')
  if (invitation.acceptedAt) throw new Error('La invitación ya fue aceptada')
  return { invitation, token: newToken(), expiresAt: expiryFromNow() }
}

// Persiste la rotación del reenvío. Solo se llama tras enviar el email con el `token` nuevo.
export async function commitResend(id: string, token: string, expiresAt: Date) {
  return prisma.invitation.update({
    where: { id },
    data: { token, expiresAt, lastSentAt: new Date() },
    include: invitationInclude,
  })
}

export async function deleteInvitation(id: string) {
  const invitation = await prisma.invitation.findUnique({ where: { id } })
  if (!invitation) throw new Error('Invitación no encontrada')
  if (invitation.acceptedAt) throw new Error('No se puede eliminar una invitación aceptada')
  return prisma.invitation.delete({ where: { id } })
}

// Si falló el envío del email tras crearla, se elimina para no dejar una pendiente fantasma.
export async function deleteInvitationUnsent(id: string) {
  return prisma.invitation.delete({ where: { id } })
}

// Marca la invitación como aceptada por un usuario. Tolerante: si no existe, expiró
// o ya fue aceptada, devuelve null sin lanzar (los callers — hook del onboarding,
// visita logueada al link — no deben romper el flujo principal por esto).
export async function acceptInvitation(token: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({ where: { token } })
  if (!invitation) return null
  if (invitation.acceptedAt) return null
  if (invitation.expiresAt < new Date()) return null

  return prisma.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date(), acceptedUserId: userId },
  })
}

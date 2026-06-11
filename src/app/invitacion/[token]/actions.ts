'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { INVITE_COOKIE } from '@/lib/constants/invitation'
import { INVITATION_EXPIRES_DAYS, getInvitationByToken } from '@/services/invitation-service'

// CTA de la invitación (visitante anónimo): deja la cookie que vincula el registro
// con la invitación y manda al login (el alta real es por WhatsApp). La aceptación
// se marca al completar el onboarding, leyendo esta cookie.
export async function startInvitedSignup(token: string): Promise<void> {
  const invitation = await getInvitationByToken(token)
  // Inválida/expirada/aceptada: recargar la página para que muestre el estado real.
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    redirect(`/invitacion/${token}`)
  }

  const jar = await cookies()
  jar.set(INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: INVITATION_EXPIRES_DAYS * 24 * 60 * 60,
    path: '/',
  })
  redirect('/login')
}

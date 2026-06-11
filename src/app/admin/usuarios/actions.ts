'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import { createInvitationSchema } from '@/lib/validations/invitation'
import {
  INVITATION_EXPIRES_DAYS,
  commitResend,
  createInvitation,
  deleteInvitation,
  deleteInvitationUnsent,
  prepareResend,
} from '@/services/invitation-service'
import { sendInvitationEmail } from '@/services/email-service'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

async function requireSuperadmin() {
  const user = await requireUser()
  if (user.role !== 'SUPERADMIN') throw new Error('No autorizado')
  return user
}

function acceptUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tenis-tracker.app'
  return `${baseUrl}/invitacion/${token}`
}

export async function inviteUserAction(input: {
  name: string
  email: string
}): Promise<ActionResult> {
  const parsed = createInvitationSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  try {
    const admin = await requireSuperadmin()
    const invitation = await createInvitation({ ...parsed.data, invitedById: admin.id })

    try {
      await sendInvitationEmail({
        to: invitation.email,
        inviteeName: invitation.name,
        inviterName: invitation.invitedBy.name ?? 'Tenis Tracker',
        acceptUrl: acceptUrl(invitation.token),
        expiresInDays: INVITATION_EXPIRES_DAYS,
      })
    } catch (error) {
      // Sin email no hay invitación: borrarla para poder reintentar limpio.
      await deleteInvitationUnsent(invitation.id)
      return { success: false, error: errorMessage(error, 'No se pudo enviar el email') }
    }

    revalidatePath('/admin/usuarios')
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo crear la invitación') }
  }
}

export async function resendInvitationAction(id: string): Promise<ActionResult> {
  try {
    await requireSuperadmin()
    // Enviar ANTES de rotar: si el email falla, el link anterior sigue siendo válido.
    const { invitation, token, expiresAt } = await prepareResend(id)
    await sendInvitationEmail({
      to: invitation.email,
      inviteeName: invitation.name,
      inviterName: invitation.invitedBy.name ?? 'Tenis Tracker',
      acceptUrl: acceptUrl(token),
      expiresInDays: INVITATION_EXPIRES_DAYS,
    })
    await commitResend(id, token, expiresAt)
    revalidatePath('/admin/usuarios')
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo reenviar la invitación') }
  }
}

export async function cancelInvitationAction(id: string): Promise<ActionResult> {
  try {
    await requireSuperadmin()
    await deleteInvitation(id)
    revalidatePath('/admin/usuarios')
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo eliminar la invitación') }
  }
}

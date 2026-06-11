'use server'

import { cookies } from 'next/headers'
import { Prisma } from '@prisma/client'
import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import { INVITE_COOKIE } from '@/lib/constants/invitation'
import { completeOnboardingSchema } from '@/lib/validations/onboarding'
import { validateSlugFormat } from '@/lib/slug'
import { getUserByEmail, isSlugTaken, setUserEmail, setUserSlugAndName } from '@/services/user-service'
import { acceptInvitation } from '@/services/invitation-service'

export type SlugStatus = 'available' | 'taken' | 'reserved' | 'invalid'

// Verificación en vivo de disponibilidad (estilo GitHub). Los estados "no disponible"
// NO son errores de la action: viajan en data.status.
export async function checkSlugAvailability(raw: string): Promise<ActionResult<{ status: SlugStatus }>> {
  try {
    await requireUser()
    const slug = raw.trim().toLowerCase()
    const fmt = validateSlugFormat(slug)
    if (!fmt.ok) {
      return { success: true, data: { status: fmt.reason === 'reserved' ? 'reserved' : 'invalid' } }
    }
    const taken = await isSlugTaken(slug)
    return { success: true, data: { status: taken ? 'taken' : 'available' } }
  } catch {
    return { success: false, error: 'No se pudo verificar la disponibilidad' }
  }
}

export async function completeOnboarding(input: {
  name: string
  slug: string
  email?: string | null
}): Promise<ActionResult<{ slug: string }>> {
  const parsed = completeOnboardingSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  try {
    const user = await requireUser()
    const { name, slug, email } = parsed.data
    if (await isSlugTaken(slug)) {
      return { success: false, error: 'Ese link ya fue tomado, probá otro' }
    }
    // Si vino email: lo guardamos sin verificar (banner persistente fuerza el verify después).
    // Si otro user ya lo usa, devolvemos error explícito; el slug igual no se setea (ambas
    // ops en orden: chequeo de email → setUserSlugAndName → setUserEmail).
    if (email) {
      const conflict = await getUserByEmail(email)
      if (conflict && conflict.id !== user.id) {
        return { success: false, error: 'Ese email ya está usado por otra cuenta' }
      }
    }
    await setUserSlugAndName(user.id, name, slug)
    if (email) await setUserEmail(user.id, email)
    // Si entró por una invitación del admin, marcarla aceptada (best-effort:
    // un fallo acá no debe romper un onboarding que ya se completó).
    try {
      const jar = await cookies()
      const inviteToken = jar.get(INVITE_COOKIE)?.value
      if (inviteToken) {
        await acceptInvitation(inviteToken, user.id)
        jar.delete(INVITE_COOKIE)
      }
    } catch {
      // best-effort
    }
    return { success: true, data: { slug } }
  } catch (error) {
    // Race del live-check: dos requests con el mismo slug → unique violation.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'Ese link ya fue tomado, probá otro' }
    }
    return { success: false, error: 'No se pudo guardar tu perfil' }
  }
}

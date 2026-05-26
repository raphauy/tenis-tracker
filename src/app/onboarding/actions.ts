'use server'

import { Prisma } from '@prisma/client'
import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import { completeOnboardingSchema } from '@/lib/validations/onboarding'
import { validateSlugFormat } from '@/lib/slug'
import { isSlugTaken, setUserSlugAndName } from '@/services/user-service'

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
}): Promise<ActionResult<{ slug: string }>> {
  const parsed = completeOnboardingSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  try {
    const user = await requireUser()
    const { name, slug } = parsed.data
    if (await isSlugTaken(slug)) {
      return { success: false, error: 'Ese link ya fue tomado, probá otro' }
    }
    await setUserSlugAndName(user.id, name, slug)
    return { success: true, data: { slug } }
  } catch (error) {
    // Race del live-check: dos requests con el mismo slug → unique violation.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'Ese link ya fue tomado, probá otro' }
    }
    return { success: false, error: 'No se pudo guardar tu perfil' }
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import { setFavoriteChannel, setUserNotifyModes } from '@/services/notification-service'
import {
  setFavoriteChannelSchema,
  setNotifyModesSchema,
  type SetFavoriteChannelInput,
  type SetNotifyModesInput,
} from '@/lib/validations/notificaciones'

export async function setNotifyModeAction(input: SetNotifyModesInput): Promise<ActionResult> {
  const parsed = setNotifyModesSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    const user = await requireUser()
    const { slug, emailMode, whatsappMode } = parsed.data
    await setUserNotifyModes(user.id, { emailMode, whatsappMode })
    revalidatePath(`/${slug}`, 'layout') // refresca el nudge y la página
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo guardar' }
  }
}

export async function setFavoriteChannelAction(
  input: SetFavoriteChannelInput
): Promise<ActionResult> {
  const parsed = setFavoriteChannelSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    const user = await requireUser()
    const { slug, nameKey, notifyEmail, notifyWhatsapp } = parsed.data
    await setFavoriteChannel(user.id, nameKey, { notifyEmail, notifyWhatsapp })
    revalidatePath(`/${slug}/notificaciones`)
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo guardar' }
  }
}

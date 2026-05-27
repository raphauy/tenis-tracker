'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import { sendTextSchema } from '@/lib/validations/whatsapp'
import * as whatsappService from '@/services/whatsapp-service'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

// Gate: solo el superadmin opera el inbox. Lanza si no corresponde.
async function requireSuperadmin() {
  const user = await requireUser()
  if (user.role !== 'SUPERADMIN') throw new Error('No autorizado')
  return user
}

export async function sendTextAction(input: { to: string; body: string }): Promise<ActionResult> {
  const parsed = sendTextSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  try {
    await requireSuperadmin()
    await whatsappService.sendText(parsed.data)
    revalidatePath('/admin/whatsapp')
    return { success: true }
  } catch (error) {
    console.error('[whatsapp] error al enviar mensaje:', error)
    return { success: false, error: errorMessage(error, 'No se pudo enviar el mensaje') }
  }
}

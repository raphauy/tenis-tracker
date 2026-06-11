'use server'

import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import { dismissNotifyNudge } from '@/services/notification-service'

// Descarta el nudge de notificaciones para siempre (persiste notifyNudgeDismissedAt).
export async function dismissNotifyNudgeAction(): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await dismissNotifyNudge(user.id)
    return { success: true }
  } catch {
    return { success: false, error: 'No se pudo descartar' }
  }
}

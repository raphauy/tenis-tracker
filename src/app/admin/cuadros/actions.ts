'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import { syncExternalBrackets, type SyncReport } from '@/services/external-bracket-service'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

async function requireSuperadmin() {
  const user = await requireUser()
  if (user.role !== 'SUPERADMIN') throw new Error('No autorizado')
  return user
}

// Botón "sincronizar ahora" del panel /admin/cuadros. Mismo orquestador que el cron.
export async function syncNowAction(): Promise<ActionResult<SyncReport>> {
  try {
    await requireSuperadmin()
    const report = await syncExternalBrackets()
    revalidatePath('/admin/cuadros')
    revalidatePath('/cuadros')
    return { success: true, data: report }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo sincronizar') }
  }
}

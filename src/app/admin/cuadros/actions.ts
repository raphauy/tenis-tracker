'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import {
  setTournamentStatus,
  syncExternalBrackets,
  type SyncReport,
} from '@/services/external-bracket-service'

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

// Finaliza un torneo a mano: lo marca ARCHIVED ("finalizado"). Útil cuando el torneo ya
// terminó pero la fuente dejó datos incompletos (ej. MUR sin el resultado de una semi),
// así que el archivado por completitud no dispara. En fuentes 'completion' (MUR), esto
// además lo congela: el próximo sync no lo vuelve a bajar.
export async function finalizeTournamentAction(id: string): Promise<ActionResult<void>> {
  try {
    await requireSuperadmin()
    await setTournamentStatus(id, 'ARCHIVED')
    revalidatePath('/admin/cuadros')
    revalidatePath('/cuadros')
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo finalizar') }
  }
}

// Reactiva un torneo finalizado: lo vuelve a LIVE. Útil cuando la fuente cargó un resultado
// faltante: al quedar LIVE, el próximo sync lo vuelve a bajar y actualizar (y si quedó
// completo, se vuelve a archivar solo). Reversible, sin confirmación.
export async function reactivateTournamentAction(id: string): Promise<ActionResult<void>> {
  try {
    await requireSuperadmin()
    await setTournamentStatus(id, 'LIVE')
    revalidatePath('/admin/cuadros')
    revalidatePath('/cuadros')
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo reactivar') }
  }
}

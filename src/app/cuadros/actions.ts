'use server'

import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import { toggleFavorite } from '@/services/favorite-service'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

// Marca/desmarca un jugador (por nombre) como favorito del usuario logueado.
// No revalida: las pages de /cuadros son force-dynamic (re-fetch en cada carga) y el
// cliente actualiza de forma optimista en todas las apariciones del nombre.
export async function toggleFavoritePlayerAction(
  name: string
): Promise<ActionResult<{ favorited: boolean }>> {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return { success: false, error: 'Nombre inválido' }

  try {
    const user = await requireUser()
    const favorited = await toggleFavorite(user.id, trimmed)
    return { success: true, data: { favorited } }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo actualizar el favorito') }
  }
}

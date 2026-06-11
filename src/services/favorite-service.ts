import { Prisma } from '@prisma/client'
import type { EmailNotifyMode, WhatsappNotifyMode } from '@prisma/client'
import { prisma, withRetry } from '@/lib/prisma'
import { normalizeName } from '@/lib/text'

// Favoritos de cuadros por NOMBRE normalizado (los nombres del cuadro son strings,
// sin link a Player/usuarios). Única capa Prisma de la feature.

// Las claves normalizadas de los jugadores que el usuario marcó como favoritos.
export async function getFavoriteKeys(userId: string): Promise<string[]> {
  const rows = await withRetry(() =>
    prisma.favoritePlayer.findMany({ where: { userId }, select: { nameKey: true } })
  )
  return rows.map((r) => r.nameKey)
}

export type FavoriteForNotification = {
  userId: string
  nameKey: string
  name: string
  notifyEmail: boolean
  notifyWhatsapp: boolean
  // Modos del dueño, para decidir en el motor si algún canal podría entregar (evita filas muertas).
  user: {
    emailVerifiedAt: Date | null
    notifyEmailMode: EmailNotifyMode
    notifyWhatsappMode: WhatsappNotifyMode
  }
}

// Favoritos de TODOS los users cuyo nameKey está en la lista. Para el cruce del motor de
// notificaciones: los nombres que registraron un resultado nuevo en el sync → quién los sigue,
// con qué canales activos (toggles del favorito) y los modos del dueño.
export async function findByNameKeys(nameKeys: string[]): Promise<FavoriteForNotification[]> {
  if (nameKeys.length === 0) return []
  return withRetry(() =>
    prisma.favoritePlayer.findMany({
      where: { nameKey: { in: nameKeys } },
      select: {
        userId: true,
        nameKey: true,
        name: true,
        notifyEmail: true,
        notifyWhatsapp: true,
        user: {
          select: { emailVerifiedAt: true, notifyEmailMode: true, notifyWhatsappMode: true },
        },
      },
    })
  )
}

// Favoritos de un usuario para el panel admin (/admin/usuarios): nombre + toggles por canal.
export async function getFavoritesByUserAdmin(userId: string) {
  return withRetry(() =>
    prisma.favoritePlayer.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, notifyEmail: true, notifyWhatsapp: true },
    })
  )
}

// Toggle: si ya es favorito lo quita (devuelve false), si no lo agrega (devuelve true).
// Idempotente ante doble click concurrente: `deleteMany` no falla si no hay fila, y un
// `create` que choca con el unique (otro toggle ganó la carrera) se trata como "ya es
// favorito" (true) en vez de propagar P2002.
export async function toggleFavorite(userId: string, name: string): Promise<boolean> {
  const nameKey = normalizeName(name)
  if (!nameKey) throw new Error('Nombre inválido')

  return withRetry(async () => {
    const removed = await prisma.favoritePlayer.deleteMany({ where: { userId, nameKey } })
    if (removed.count > 0) return false

    try {
      await prisma.favoritePlayer.create({ data: { userId, name: name.trim(), nameKey } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return true
      throw e
    }
    return true
  })
}

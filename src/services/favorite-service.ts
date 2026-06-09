import { Prisma } from '@prisma/client'
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

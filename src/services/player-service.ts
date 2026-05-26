import { prisma, withRetry } from '@/lib/prisma'
import type { CreatePlayerInput } from '@/lib/validations/player'
import { toPlayerNameCase } from '@/lib/text'

// Jugador del catálogo con flag de borrable: solo si lo creó el usuario y nadie lo usa.
export type PlayerOption = { id: string; name: string; deletable: boolean }

// Jugador para el panel admin: nombre, creador y cantidad de partidos donde es rival.
export type PlayerAdmin = {
  id: string
  name: string
  createdById: string
  matchCount: number
}

// Jugador es catálogo compartido sin gate: visible para todos, creación libre.
// Los fusionados (mergedIntoId) quedan archivados y no se listan.
export async function getPlayersForUser(userId: string): Promise<PlayerOption[]> {
  const players = await withRetry(() =>
    prisma.player.findMany({
      where: { mergedIntoId: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, createdById: true, _count: { select: { matches: true } } },
    })
  )
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    deletable: p.createdById === userId && p._count.matches === 0,
  }))
}

export async function createPlayer(input: CreatePlayerInput, createdById: string) {
  return withRetry(() =>
    prisma.player.create({ data: { name: toPlayerNameCase(input.name), createdById } })
  )
}

// Borra un jugador solo si lo creó el usuario y no está referenciado en ningún partido.
export async function deletePlayer(id: string, userId: string) {
  return withRetry(async () => {
    const player = await prisma.player.findUnique({
      where: { id },
      select: { createdById: true, _count: { select: { matches: true } } },
    })
    if (!player) throw new Error('Jugador no encontrado')
    if (player.createdById !== userId) throw new Error('Solo podés borrar jugadores que creaste vos')
    if (player._count.matches > 0) throw new Error('No se puede borrar: el jugador está en uso')
    await prisma.player.delete({ where: { id } })
  })
}

// ---------- Moderación (superadmin) ----------

// Lista de jugadores no archivados con su uso (el filtrado por nombre lo hace el cliente).
// El gate de rol va en la action.
export async function getPlayersAdmin(): Promise<PlayerAdmin[]> {
  const players = await withRetry(() =>
    prisma.player.findMany({
      where: { mergedIntoId: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, createdById: true, _count: { select: { matches: true } } },
    })
  )
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    createdById: p.createdById,
    matchCount: p._count.matches,
  }))
}

export async function updatePlayerName(id: string, name: string) {
  return withRetry(() =>
    prisma.player.update({ where: { id }, data: { name: toPlayerNameCase(name) } })
  )
}

// Borrado admin: cualquier jugador sin partidos (sin filtrar por creador).
export async function deletePlayerAdmin(id: string) {
  return withRetry(async () => {
    const player = await prisma.player.findUnique({
      where: { id },
      select: { _count: { select: { matches: true } } },
    })
    if (!player) throw new Error('Jugador no encontrado')
    if (player._count.matches > 0) throw new Error('No se puede borrar: el jugador está en uso. Fusionalo en su lugar')
    await prisma.player.delete({ where: { id } })
  })
}

// Cantidad de partidos que se reapuntarían al fusionar (para el preview).
export async function getPlayerMergeImpact(duplicateId: string): Promise<{ matchCount: number }> {
  const count = await withRetry(() => prisma.match.count({ where: { opponentId: duplicateId } }))
  return { matchCount: count }
}

// Fusiona el jugador duplicado en el canónico: reapunta los partidos y archiva el duplicado.
// Match no tiene unique sobre opponentId → no hay colisión posible.
export async function mergePlayer(duplicateId: string, canonicalId: string) {
  if (duplicateId === canonicalId) throw new Error('No se puede fusionar un jugador consigo mismo')
  return withRetry(() =>
    prisma.$transaction(async (tx) => {
      const [dup, canonical] = await Promise.all([
        tx.player.findUnique({ where: { id: duplicateId }, select: { mergedIntoId: true } }),
        tx.player.findUnique({ where: { id: canonicalId }, select: { mergedIntoId: true } }),
      ])
      if (!dup || dup.mergedIntoId) throw new Error('El jugador a fusionar no existe o ya fue fusionado')
      if (!canonical || canonical.mergedIntoId) throw new Error('El jugador canónico no existe o está archivado')

      await tx.match.updateMany({ where: { opponentId: duplicateId }, data: { opponentId: canonicalId } })
      await tx.player.update({ where: { id: duplicateId }, data: { mergedIntoId: canonicalId } })
    })
  )
}

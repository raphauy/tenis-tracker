import { prisma, withRetry } from '@/lib/prisma'
import type { CreatePlayerInput } from '@/lib/validations/player'

// Jugador del catálogo con flag de borrable: solo si lo creó el usuario y nadie lo usa.
export type PlayerOption = { id: string; name: string; deletable: boolean }

// Jugador es catálogo compartido sin gate: visible para todos, creación libre.
export async function getPlayersForUser(userId: string): Promise<PlayerOption[]> {
  const players = await withRetry(() =>
    prisma.player.findMany({
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
    prisma.player.create({ data: { name: input.name, createdById } })
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

'use server'

import { revalidatePath } from 'next/cache'
import type { Venue, Category, Player, Tournament } from '@prisma/client'
import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import { createVenueSchema } from '@/lib/validations/venue'
import { createCategorySchema } from '@/lib/validations/category'
import { createPlayerSchema } from '@/lib/validations/player'
import { createTournamentSchema } from '@/lib/validations/tournament'
import { createEntrySchema } from '@/lib/validations/entry'
import { matchPayloadSchema, updateMatchSchema } from '@/lib/validations/match'
import * as venueService from '@/services/venue-service'
import * as categoryService from '@/services/category-service'
import * as playerService from '@/services/player-service'
import * as tournamentService from '@/services/tournament-service'
import {
  createEntryWithMatch,
  findOrCreateEntry,
  deleteEntry,
} from '@/services/entry-service'
import { createMatch, updateMatch, deleteMatch } from '@/services/match-service'
import { prisma } from '@/lib/prisma'

// Mensaje de error legible desde un throw de service.
function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export async function createVenueAction(name: string): Promise<ActionResult<Venue>> {
  const parsed = createVenueSchema.safeParse({ name })
  if (!parsed.success) return { success: false, error: 'Nombre de sede inválido' }
  try {
    const user = await requireUser()
    const venue = await venueService.createVenue(parsed.data, user.id)
    return { success: true, data: venue }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo crear la sede') }
  }
}

export async function createCategoryAction(name: string): Promise<ActionResult<Category>> {
  const parsed = createCategorySchema.safeParse({ name })
  if (!parsed.success) return { success: false, error: 'Nombre de categoría inválido' }
  try {
    const user = await requireUser()
    const category = await categoryService.createCategory(parsed.data, user.id)
    return { success: true, data: category }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo crear la categoría') }
  }
}

export async function createPlayerAction(name: string): Promise<ActionResult<Player>> {
  const parsed = createPlayerSchema.safeParse({ name })
  if (!parsed.success) return { success: false, error: 'Nombre de jugador inválido' }
  try {
    const user = await requireUser()
    const player = await playerService.createPlayer(parsed.data, user.id)
    return { success: true, data: player }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo crear el jugador') }
  }
}

export async function deletePlayerAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await playerService.deletePlayer(id, user.id)
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo borrar el jugador') }
  }
}

export async function createTournamentAction(input: {
  name: string
  venueId: string
  month: number
  year: number
}): Promise<ActionResult<Tournament>> {
  const parsed = createTournamentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos del torneo inválidos' }
  try {
    const user = await requireUser()
    // Guardar día 1 del mes en UTC (evita corrimiento por timezone del runtime).
    const startDate = new Date(Date.UTC(parsed.data.year, parsed.data.month - 1, 1))
    const tournament = await tournamentService.createTournament(
      { name: parsed.data.name, venueId: parsed.data.venueId, startDate },
      user.id
    )
    return { success: true, data: tournament }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo crear el torneo') }
  }
}

// Alta completa (wizard): crea/reusa Participación + primer partido (atómico).
export async function createEntryWithMatchAction(
  input: {
    tournamentId: string
    categoryId: string
    match: unknown
  },
  slug: string
): Promise<ActionResult<{ entryId: string }>> {
  const entry = createEntrySchema.safeParse({
    tournamentId: input.tournamentId,
    categoryId: input.categoryId,
  })
  if (!entry.success) return { success: false, error: 'Elegí torneo y categoría' }
  const match = matchPayloadSchema.safeParse(input.match)
  if (!match.success) {
    return { success: false, error: match.error.issues[0]?.message ?? 'Datos del partido inválidos' }
  }
  try {
    const user = await requireUser()
    const result = await createEntryWithMatch(entry.data, match.data, user.id)
    revalidatePath(`/${slug}`)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo crear la participación') }
  }
}

// Agregar un partido a una Participación existente.
export async function addMatchAction(
  input: {
    entryId: string
    match: unknown
  },
  slug: string
): Promise<ActionResult> {
  const match = matchPayloadSchema.safeParse(input.match)
  if (!match.success) {
    return { success: false, error: match.error.issues[0]?.message ?? 'Datos del partido inválidos' }
  }
  if (!input.entryId) return { success: false, error: 'Participación inválida' }
  try {
    const user = await requireUser()
    await createMatch(prisma, input.entryId, match.data, user.id)
    revalidatePath(`/${slug}`)
    revalidatePath(`/${slug}/participacion/${input.entryId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo agregar el partido') }
  }
}

export async function updateMatchAction(input: unknown, slug: string): Promise<ActionResult> {
  const parsed = updateMatchSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos del partido inválidos' }
  }
  try {
    const user = await requireUser()
    const match = await updateMatch(parsed.data, user.id)
    revalidatePath(`/${slug}`)
    revalidatePath(`/${slug}/participacion/${match.entryId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo actualizar el partido') }
  }
}

export async function deleteMatchAction(id: string, slug: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await deleteMatch(id, user.id)
    revalidatePath(`/${slug}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo borrar el partido') }
  }
}

export async function deleteEntryAction(id: string, slug: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    await deleteEntry(id, user.id)
    revalidatePath(`/${slug}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo borrar la participación') }
  }
}

// Wrappers de catálogo para usar como onCreate del combobox (devuelven {id,label}).
export async function findOrCreateEntryAction(input: {
  tournamentId: string
  categoryId: string
}): Promise<ActionResult<{ entryId: string }>> {
  const parsed = createEntrySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Elegí torneo y categoría' }
  try {
    const user = await requireUser()
    const entry = await findOrCreateEntry(parsed.data, user.id)
    return { success: true, data: { entryId: entry.id } }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo crear la participación') }
  }
}

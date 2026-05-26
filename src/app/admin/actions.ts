'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { requireUser } from '@/lib/auth-helpers'
import {
  catalogKindSchema,
  nameSchema,
  updateTournamentSchema,
  mergeSchema,
  type CatalogKind,
} from '@/lib/validations/admin'
import * as venueService from '@/services/venue-service'
import * as categoryService from '@/services/category-service'
import * as tournamentService from '@/services/tournament-service'
import * as playerService from '@/services/player-service'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

// Gate: solo el superadmin opera el panel. Lanza si no corresponde.
async function requireSuperadmin() {
  const user = await requireUser()
  if (user.role !== 'SUPERADMIN') throw new Error('No autorizado')
  return user
}

// ---------- Aprobar ----------

export async function approveAction(kind: CatalogKind, id: string): Promise<ActionResult> {
  if (!catalogKindSchema.safeParse(kind).success) return { success: false, error: 'Tipo inválido' }
  try {
    await requireSuperadmin()
    switch (kind) {
      case 'venue':
        await venueService.approveVenue(id)
        break
      case 'category':
        await categoryService.approveCategory(id)
        break
      case 'tournament':
        await tournamentService.approveTournament(id)
        break
      case 'player':
        return { success: false, error: 'Los jugadores no se aprueban' }
    }
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo aprobar') }
  }
}

// ---------- Editar ----------

export async function updateNameAction(
  kind: 'venue' | 'category' | 'player',
  id: string,
  name: string
): Promise<ActionResult> {
  const parsed = nameSchema.safeParse({ name })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }
  try {
    await requireSuperadmin()
    switch (kind) {
      case 'venue':
        await venueService.updateVenue(id, parsed.data.name)
        break
      case 'category':
        await categoryService.updateCategory(id, parsed.data.name)
        break
      case 'player':
        await playerService.updatePlayerName(id, parsed.data.name)
        break
    }
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo actualizar') }
  }
}

export async function updateTournamentAction(
  id: string,
  input: { name: string; venueId: string; month: number; year: number }
): Promise<ActionResult> {
  const parsed = updateTournamentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  try {
    await requireSuperadmin()
    const startDate = new Date(Date.UTC(parsed.data.year, parsed.data.month - 1, 1))
    await tournamentService.updateTournament(id, {
      name: parsed.data.name,
      venueId: parsed.data.venueId,
      startDate,
    })
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo actualizar el torneo') }
  }
}

// ---------- Eliminar (solo si no tiene refs) ----------

export async function deleteAction(kind: CatalogKind, id: string): Promise<ActionResult> {
  if (!catalogKindSchema.safeParse(kind).success) return { success: false, error: 'Tipo inválido' }
  try {
    await requireSuperadmin()
    switch (kind) {
      case 'venue':
        await venueService.deleteVenueIfUnused(id)
        break
      case 'category':
        await categoryService.deleteCategoryIfUnused(id)
        break
      case 'tournament':
        await tournamentService.deleteTournamentIfUnused(id)
        break
      case 'player':
        await playerService.deletePlayerAdmin(id)
        break
    }
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo eliminar') }
  }
}

// ---------- Fusionar ----------

type MergeImpact = { entryCount?: number; matchCount?: number; tournamentCount?: number }

export async function mergeImpactAction(
  kind: CatalogKind,
  duplicateId: string
): Promise<ActionResult<MergeImpact>> {
  if (!catalogKindSchema.safeParse(kind).success) return { success: false, error: 'Tipo inválido' }
  try {
    await requireSuperadmin()
    switch (kind) {
      case 'venue':
        return { success: true, data: await venueService.getVenueMergeImpact(duplicateId) }
      case 'category':
        return { success: true, data: await categoryService.getCategoryMergeImpact(duplicateId) }
      case 'tournament':
        return { success: true, data: await tournamentService.getTournamentMergeImpact(duplicateId) }
      case 'player':
        return { success: true, data: await playerService.getPlayerMergeImpact(duplicateId) }
    }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo calcular el impacto') }
  }
}

export async function mergeAction(
  kind: CatalogKind,
  input: { duplicateId: string; canonicalId: string }
): Promise<ActionResult> {
  if (!catalogKindSchema.safeParse(kind).success) return { success: false, error: 'Tipo inválido' }
  const parsed = mergeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos de fusión inválidos' }
  try {
    await requireSuperadmin()
    const { duplicateId, canonicalId } = parsed.data
    switch (kind) {
      case 'venue':
        await venueService.mergeVenue(duplicateId, canonicalId)
        break
      case 'category':
        await categoryService.mergeCategory(duplicateId, canonicalId)
        break
      case 'tournament':
        await tournamentService.mergeTournament(duplicateId, canonicalId)
        break
      case 'player':
        await playerService.mergePlayer(duplicateId, canonicalId)
        break
    }
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error, 'No se pudo fusionar') }
  }
}

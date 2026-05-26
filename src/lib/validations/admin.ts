import { z } from 'zod'

// Tipo de entidad curada sobre la que opera el panel admin.
export const catalogKindSchema = z.enum(['venue', 'category', 'tournament', 'player'])
export type CatalogKind = z.infer<typeof catalogKindSchema>

export const nameSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
})

// Edición de un torneo desde el panel: nombre + sede + fecha (mes/año).
export const updateTournamentSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  venueId: z.string().min(1, 'La sede es obligatoria'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
})
export type UpdateTournamentFormInput = z.infer<typeof updateTournamentSchema>

// Fusión: marcar `duplicateId` como duplicado de `canonicalId`.
export const mergeSchema = z.object({
  duplicateId: z.string().min(1),
  canonicalId: z.string().min(1),
})
export type MergeInput = z.infer<typeof mergeSchema>

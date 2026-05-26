import { z } from 'zod'

export const createEntrySchema = z.object({
  tournamentId: z.string().min(1, 'El torneo es obligatorio'),
  categoryId: z.string().min(1, 'La categoría es obligatoria'),
})

export type CreateEntryInput = z.infer<typeof createEntrySchema>

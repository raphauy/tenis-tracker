import { z } from 'zod'

// El form envía mes (1-12) + año; la action lo convierte a startDate = día 1 del mes (UTC).
export const createTournamentSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  venueId: z.string().min(1, 'La sede es obligatoria'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
})

export type CreateTournamentFormInput = z.infer<typeof createTournamentSchema>

import { z } from 'zod'

export const createVenueSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
})

export type CreateVenueInput = z.infer<typeof createVenueSchema>

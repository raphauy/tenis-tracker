import { z } from 'zod'

export const createPlayerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
})

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>

import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>

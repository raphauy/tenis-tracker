import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  image: z
    .union([z.string().url('URL de imagen inválida'), z.literal(''), z.null()])
    .transform((v) => (v === '' ? null : v)),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

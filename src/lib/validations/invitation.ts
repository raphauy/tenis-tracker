import { z } from 'zod'

export const createInvitationSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  email: z.string().trim().toLowerCase().email('Email inválido'),
})

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>

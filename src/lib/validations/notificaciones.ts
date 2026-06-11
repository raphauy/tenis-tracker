import { z } from 'zod'

export const emailNotifyModeSchema = z.enum(['OFF', 'IMMEDIATE', 'DIGEST'])
export const whatsappNotifyModeSchema = z.enum(['OFF', 'IMMEDIATE'])

// Modos globales por canal. `slug` para revalidar la vista del dueño tras guardar.
export const setNotifyModesSchema = z
  .object({
    slug: z.string().min(1),
    emailMode: emailNotifyModeSchema.optional(),
    whatsappMode: whatsappNotifyModeSchema.optional(),
  })
  .refine((d) => d.emailMode !== undefined || d.whatsappMode !== undefined, {
    message: 'Nada para actualizar',
  })

// Toggle de un favorito por canal (silenciar ≠ quitar de favoritos).
export const setFavoriteChannelSchema = z
  .object({
    slug: z.string().min(1),
    nameKey: z.string().min(1),
    notifyEmail: z.boolean().optional(),
    notifyWhatsapp: z.boolean().optional(),
  })
  .refine((d) => d.notifyEmail !== undefined || d.notifyWhatsapp !== undefined, {
    message: 'Nada para actualizar',
  })

export type SetNotifyModesInput = z.infer<typeof setNotifyModesSchema>
export type SetFavoriteChannelInput = z.infer<typeof setFavoriteChannelSchema>

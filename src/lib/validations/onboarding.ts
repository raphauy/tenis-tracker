import { z } from 'zod'
import { RESERVED_SLUGS, SLUG_REGEX, SLUG_MIN, SLUG_MAX } from '@/lib/slug'

export const completeOnboardingSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(SLUG_MIN, `Mínimo ${SLUG_MIN} caracteres`)
    .max(SLUG_MAX, `Máximo ${SLUG_MAX} caracteres`)
    .regex(SLUG_REGEX, 'Solo letras, números y guiones')
    .refine((s) => !RESERVED_SLUGS.has(s), 'Ese link está reservado'),
  // Email opcional: rol de backup verificado para login si WhatsApp falla.
  // No se verifica acá; el banner persistente se encarga del verify diferido.
  email: z
    .union([z.literal(''), z.string().trim().toLowerCase().email('Email inválido')])
    .optional()
    .transform((v) => (v ? v : null)),
})

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>

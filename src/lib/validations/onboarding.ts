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
})

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>

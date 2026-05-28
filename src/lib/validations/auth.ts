import { z } from 'zod'
import { PENDING_AUTH_CODE_LENGTH } from '@/lib/constants/auth'

// Código de sesión del Magic-link inverso (PendingAuth.code).
// Mismo charset que generamos en pending-auth-service: A-HJ-NP-Z2-9 (sin 0/O/1/I/L).
export const pendingAuthCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(PENDING_AUTH_CODE_LENGTH)
  .regex(/^[A-HJ-NP-Z2-9]+$/, 'Código inválido')

// Email para el flujo de Email backup (verify + login backup).
export const emailSchema = z.string().trim().toLowerCase().email('Email inválido')

// OTP de 6 dígitos por email (Resend). Reusa la maquinaria existente de OtpToken.
export const emailOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().length(6).regex(/^\d{6}$/, 'Código inválido'),
})

export type PendingAuthCode = z.infer<typeof pendingAuthCodeSchema>
export type EmailOtpInput = z.infer<typeof emailOtpSchema>

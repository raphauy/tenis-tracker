'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-helpers'
import { getUserByEmail, setEmailVerified, setUserEmail } from '@/services/user-service'
import {
  generateOtp,
  createOtpToken,
  verifyOtpToken,
  OTP_EXPIRY_MINUTES,
} from '@/services/auth-service'
import { sendOtpEmail } from '@/services/email-service'
import { emailSchema, emailOtpSchema } from '@/lib/validations/auth'
import type { ActionResult } from '@/lib/types'

// Pide el OTP para verificar el email del usuario logueado.
// Si vino un email distinto al actual del User, lo guarda primero (y resetea emailVerifiedAt).
// Devuelve el email normalizado para que el dialog lo use al verificar.
export async function requestEmailVerifyAction(
  emailInput: string,
): Promise<ActionResult<{ email: string }>> {
  const parsed = emailSchema.safeParse(emailInput.trim().toLowerCase())
  if (!parsed.success) {
    return { success: false, error: 'Email inválido' }
  }
  const email = parsed.data

  try {
    const user = await requireUser()
    // Si el email ya lo usa otro User, no podemos atarlo. Mensaje claro: el usuario está
    // verificando ALGO suyo, no es enumeración pública.
    const conflict = await getUserByEmail(email)
    if (conflict && conflict.id !== user.id) {
      return { success: false, error: 'Ese email ya está usado por otra cuenta' }
    }
    // setUserEmail también resetea emailVerifiedAt si está cambiando.
    await setUserEmail(user.id, email)

    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
    await createOtpToken({ userId: user.id, token: otp, expiresAt })
    await sendOtpEmail({ to: email, otp })
    return { success: true, data: { email } }
  } catch (error) {
    console.error('requestEmailVerifyAction error:', error)
    return { success: false, error: 'No pudimos enviar el código. Intentá de nuevo.' }
  }
}

// Verifica el OTP y marca emailVerifiedAt. Revalida los layouts para que el banner
// desaparezca sin recarga manual.
export async function verifyEmailAction(input: {
  email: string
  otp: string
}): Promise<ActionResult> {
  const parsed = emailOtpSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  try {
    const user = await requireUser()
    const ok = await verifyOtpToken({ userId: user.id, token: parsed.data.otp })
    if (!ok) return { success: false, error: 'Código inválido o vencido' }
    await setEmailVerified(user.id)
    // Layout-level revalidate: el banner se renderiza desde layouts (/[slug] y /admin).
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('verifyEmailAction error:', error)
    return { success: false, error: 'No pudimos verificar el código.' }
  }
}

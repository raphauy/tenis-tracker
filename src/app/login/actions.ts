'use server'

import { getUserByEmail } from '@/services/user-service'
import { generateOtp, createOtpToken, OTP_EXPIRY_MINUTES } from '@/services/auth-service'
import { sendOtpEmail } from '@/services/email-service'
import { createPendingAuth } from '@/services/pending-auth-service'
import { emailSchema } from '@/lib/validations/auth'
import { WA_LOGIN_PREFIX } from '@/lib/constants/auth'
import type { ActionResult } from '@/lib/types'

// Email backup (Fase 2): no crea usuarios — solo loguea a quienes ya verificaron email
// desde un login WA previo. Mensaje de error genérico para no enumerar emails.
const GENERIC_BACKUP_ERROR = 'No pudimos enviar el código. Probá ingresar por WhatsApp.'

export async function requestOtpAction(email: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(email.trim().toLowerCase())
  if (!parsed.success) {
    return { success: false, error: 'Email inválido' }
  }

  try {
    const user = await getUserByEmail(parsed.data)
    // Sin User, o User sin email verificado, o inactivo: rechazo genérico (no enumeración).
    if (!user || !user.isActive || !user.emailVerifiedAt || !user.email) {
      return { success: false, error: GENERIC_BACKUP_ERROR }
    }
    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
    await createOtpToken({ userId: user.id, token: otp, expiresAt })
    await sendOtpEmail({ to: user.email, otp })
    return { success: true }
  } catch (error) {
    console.error('requestOtpAction error:', error)
    return { success: false, error: GENERIC_BACKUP_ERROR }
  }
}

// Magic-link inverso (Fase 2, canal primario de auth). Crea un PendingAuth y
// devuelve la URL de wa.me con el código en el texto prefijado. La web abre
// esa URL en una nueva pestaña y queda polleando /api/auth/wa/status?code=...
// hasta que el webhook resuelve el match (o expira a los 10 min).
export async function requestWaLoginAction(): Promise<
  ActionResult<{ code: string; waUrl: string }>
> {
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER
  if (!waNumber) {
    console.error('NEXT_PUBLIC_WA_NUMBER no está configurado')
    return { success: false, error: 'WhatsApp no está disponible. Probá con email.' }
  }
  try {
    const pending = await createPendingAuth()
    const text = `${WA_LOGIN_PREFIX} ${pending.code}`
    // Sanitizamos el número para wa.me (sin '+', sin espacios).
    const cleanNumber = waNumber.replace(/\D/g, '')
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`
    return { success: true, data: { code: pending.code, waUrl } }
  } catch (error) {
    console.error('requestWaLoginAction error:', error)
    return { success: false, error: 'No pudimos iniciar el login. Intentá de nuevo.' }
  }
}

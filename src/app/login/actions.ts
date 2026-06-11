'use server'

import { cookies } from 'next/headers'
import { getUserByEmail, getUserAccessInfo } from '@/services/user-service'
import { generateOtp, createOtpToken, OTP_EXPIRY_MINUTES } from '@/services/auth-service'
import { sendOtpEmail } from '@/services/email-service'
import { createPendingAuth } from '@/services/pending-auth-service'
import { acceptInvitation } from '@/services/invitation-service'
import { emailSchema } from '@/lib/validations/auth'
import { WA_LOGIN_PREFIX } from '@/lib/constants/auth'
import { INVITE_COOKIE } from '@/lib/constants/invitation'
import { requireUser } from '@/lib/auth-helpers'
import { getPostLoginUrl } from '@/lib/auth-redirect'
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

// Post-login: resuelve el destino y consume la invitación si aplica. Usuario nuevo (sin
// slug) → /onboarding, dejando viva la cookie de invitación (prefill + accept ahí). Si YA
// tenía cuenta (slug puesto), la invitación se da por aceptada acá — no va a pasar por el
// onboarding. Best-effort: nunca rompe el login (ante un error devuelve el default; el
// proxy igual fuerza onboarding en la primera ruta privada).
export async function afterLoginAction(): Promise<string> {
  try {
    const user = await requireUser()
    const info = await getUserAccessInfo(user.id)
    if (!info?.slug) return '/onboarding'
    const jar = await cookies()
    const token = jar.get(INVITE_COOKIE)?.value
    if (token) {
      await acceptInvitation(token, user.id)
      jar.delete(INVITE_COOKIE)
    }
  } catch {
    // best-effort
  }
  return getPostLoginUrl()
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

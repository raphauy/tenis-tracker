'use server'

import { z } from 'zod'
import { upsertUserByEmail } from '@/services/user-service'
import { generateOtp, createOtpToken, OTP_EXPIRY_MINUTES } from '@/services/auth-service'
import { sendOtpEmail } from '@/services/email-service'

type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string }

const emailSchema = z.object({ email: z.string().email() })

export async function requestOtpAction(email: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse({ email: email.trim().toLowerCase() })
  if (!parsed.success) {
    return { success: false, error: 'Email inválido' }
  }

  try {
    const user = await upsertUserByEmail(parsed.data.email)
    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
    await createOtpToken({ userId: user.id, token: otp, expiresAt })
    await sendOtpEmail({ to: user.email, otp })
    return { success: true }
  } catch (error) {
    console.error('requestOtpAction error:', error)
    return { success: false, error: 'No pudimos enviar el código. Intentá de nuevo.' }
  }
}

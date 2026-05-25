import { Resend } from 'resend'
import OtpEmail from '@/components/emails/otp-email'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/**
 * Decide si efectivamente despachar emails al provider.
 * Por default se envían. Setear `DO_NOT_SEND_EMAILS=true` para desactivar el envío
 * (típicamente en dev, para iterar sin saturar inbox).
 *
 * El OTP se loguea a consola siempre (en no-producción) para visibilidad,
 * y este helper decide si además se envía a Resend.
 */
function shouldSendEmails(): boolean {
  return process.env.DO_NOT_SEND_EMAILS !== 'true'
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || 'Tenis Tracker <onboarding@resend.dev>'
}

interface SendOtpEmailInput {
  to: string
  otp: string
}

export async function sendOtpEmail(input: SendOtpEmailInput): Promise<void> {
  const { to, otp } = input

  if (process.env.NODE_ENV !== 'production') {
    console.log('\n========================================')
    console.log(`  OTP Code for ${to}: ${otp}`)
    console.log('========================================\n')
  }

  if (!shouldSendEmails()) return

  if (!resend) {
    throw new Error('RESEND_API_KEY no está configurado')
  }

  await resend.emails.send({
    from: fromAddress(),
    to,
    subject: 'Tu código de verificación de Tenis Tracker',
    react: OtpEmail({ otp }),
  })
}

import { Resend } from 'resend'
import OtpEmail from '@/components/emails/otp-email'
import CurationEmail from '@/components/emails/curation-email'
import SyncAlertEmail from '@/components/emails/sync-alert-email'
import ResultNotificationEmail from '@/components/emails/result-notification-email'
import DailyDigestEmail from '@/components/emails/daily-digest-email'
import InvitationEmail from '@/components/emails/invitation-email'
import { notificationTitle, type NotificationView } from '@/lib/notifications/copy'

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

interface SendCurationDigestInput {
  to: string[]
  venues: number
  categories: number
  tournaments: number
  adminUrl: string
}

// Notificación diaria al superadmin con la cola de curado pendiente.
export async function sendCurationDigestEmail(input: SendCurationDigestInput): Promise<void> {
  const { to, venues, categories, tournaments, adminUrl } = input
  const total = venues + categories + tournaments

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[curation] ${total} pendientes (${venues} sedes, ${categories} categorías, ${tournaments} torneos) → ${to.join(', ')}\n`)
  }

  if (!shouldSendEmails()) return
  if (to.length === 0) return
  if (!resend) throw new Error('RESEND_API_KEY no está configurado')

  await resend.emails.send({
    from: fromAddress(),
    to,
    subject: `${total} entrada${total === 1 ? '' : 's'} para curar en Tenis Tracker`,
    react: CurationEmail({ venues, categories, tournaments, adminUrl }),
  })
}

interface SendSyncAlertInput {
  to: string[]
  source: string
  error: string
}

// Alerta al superadmin cuando falla el sync de una fuente de cuadros. Se dispara
// solo en la transición sana→fallida (lo decide el orquestador), no en cada corrida.
export async function sendSyncAlertEmail(input: SendSyncAlertInput): Promise<void> {
  const { to, source, error } = input

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[cuadros] sync FALLÓ (${source}): ${error} → ${to.join(', ') || '(sin destinatarios)'}\n`)
  }

  if (!shouldSendEmails()) return
  if (to.length === 0) return
  if (!resend) throw new Error('RESEND_API_KEY no está configurado')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tenis-tracker.app'

  await resend.emails.send({
    from: fromAddress(),
    to,
    subject: `Falló el sync de cuadros (${source})`,
    react: SyncAlertEmail({ source, error, adminUrl: `${baseUrl}/admin/cuadros` }),
  })
}

interface SendResultNotificationInput {
  to: string
  notification: NotificationView
  appUrl: string
  settingsUrl: string
}

// Notificación inmediata: un resultado nuevo de un favorito (modo email = cada resultado).
export async function sendResultNotificationEmail(input: SendResultNotificationInput): Promise<void> {
  const { to, notification, appUrl, settingsUrl } = input

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[notif] ${notificationTitle(notification)} → ${to}\n`)
  }

  if (!shouldSendEmails()) return
  if (!resend) throw new Error('RESEND_API_KEY no está configurado')

  await resend.emails.send({
    from: fromAddress(),
    to,
    subject: notificationTitle(notification),
    react: ResultNotificationEmail({ notification, appUrl, settingsUrl }),
  })
}

interface SendInvitationEmailInput {
  to: string
  inviteeName: string
  inviterName: string
  acceptUrl: string
  expiresInDays: number
}

// Invitación a un potencial usuario (la envía el superadmin desde /admin/usuarios).
export async function sendInvitationEmail(input: SendInvitationEmailInput): Promise<void> {
  const { to, inviteeName, inviterName, acceptUrl, expiresInDays } = input

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[invitación] ${inviterName} → ${to}: ${acceptUrl}\n`)
  }

  if (!shouldSendEmails()) return
  if (!resend) throw new Error('RESEND_API_KEY no está configurado')

  await resend.emails.send({
    from: fromAddress(),
    to,
    subject: `${inviterName} te invitó a Tenis Tracker`,
    react: InvitationEmail({ inviteeName, inviterName, acceptUrl, expiresInDays }),
  })
}

interface SendDailyDigestInput {
  to: string
  items: NotificationView[]
  appUrl: string
  settingsUrl: string
}

// Resumen diario: un email con todos los resultados pendientes del día. Sin items no se envía.
export async function sendDailyDigestEmail(input: SendDailyDigestInput): Promise<void> {
  const { to, items, appUrl, settingsUrl } = input
  if (items.length === 0) return

  const subject =
    items.length === 1
      ? notificationTitle(items[0])
      : `${items.length} resultados de tus favoritos`

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[notif] resumen diario (${items.length}) → ${to}\n`)
  }

  if (!shouldSendEmails()) return
  if (!resend) throw new Error('RESEND_API_KEY no está configurado')

  await resend.emails.send({
    from: fromAddress(),
    to,
    subject,
    react: DailyDigestEmail({ items, appUrl, settingsUrl }),
  })
}

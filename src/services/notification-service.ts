import type { NotifyOutcome, Prisma, ResultNotification, User } from '@prisma/client'
import { prisma, withRetry } from '@/lib/prisma'
import { sendDailyDigestEmail, sendResultNotificationEmail } from '@/services/email-service'
import { getWindowOpen, sendTemplate, sendText } from '@/services/whatsapp-service'
import {
  bracketPath,
  whatsappFreeText,
  whatsappTemplateSpec,
  type NotificationView,
  type NotifyOutcomeKey,
} from '@/lib/notifications/copy'

// Única capa Prisma de la bandeja de salida (ResultNotification). Orquesta el dispatch de los
// avisos por email/WhatsApp. Ver docs/PRPs/notificaciones-prp.md § Motor de detección / dispatch.

const MAX_ATTEMPTS = 3 // reintentos por canal antes de rendirse (terminal + log)

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://tenis-tracker.app'
}

function settingsUrl(slug: string | null): string {
  return slug ? `${baseUrl()}/${slug}/notificaciones` : baseUrl()
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function toView(n: ResultNotification): NotificationView {
  return {
    playerName: n.playerName,
    outcome: n.outcome as NotifyOutcomeKey,
    tournamentName: n.tournamentName,
    categoryName: n.categoryName,
    roundLabel: n.roundLabel,
    nextRoundLabel: n.nextRoundLabel,
    opponentName: n.opponentName,
    score: n.score,
    tournamentSlug: n.tournamentSlug,
    categorySlug: n.categorySlug,
  }
}

// ---------- Modo efectivo (sin auto-cambio) ----------

type NotifyUser = Pick<User, 'emailVerifiedAt' | 'notifyEmailMode' | 'notifyWhatsappMode'>

// Email requiere email verificado; sin eso, el canal no entrega (queda OFF efectivo).
export function effectiveEmailMode(user: NotifyUser): 'OFF' | 'IMMEDIATE' | 'DIGEST' {
  return user.emailVerifiedAt ? user.notifyEmailMode : 'OFF'
}

// WhatsApp: el phone siempre está verificado (identidad primaria) → el modo es el guardado.
export function effectiveWhatsappMode(user: NotifyUser): 'OFF' | 'IMMEDIATE' {
  return user.notifyWhatsappMode
}

// ---------- Bandeja: alta idempotente ----------

export type RecordResultInput = {
  userId: string
  nameKey: string
  playerName: string
  tournamentId: string
  bracketId: string
  roundIndex: number
  matchSlot: number
  outcome: NotifyOutcome
  tournamentName: string
  categoryName: string
  roundLabel: string
  nextRoundLabel: string | null
  opponentName: string | null
  score: string | null
  tournamentSlug: string
  categorySlug: string
}

// Inserta filas de la bandeja saltando duplicados (idempotencia por la unique key). Devuelve
// cuántas se crearon nuevas.
export async function recordResults(inputs: RecordResultInput[]): Promise<number> {
  if (inputs.length === 0) return 0
  const res = await withRetry(() =>
    prisma.resultNotification.createMany({ data: inputs, skipDuplicates: true })
  )
  return res.count
}

// ---------- Dispatch inmediato (corre en el run del sync) ----------

type DispatchRow = ResultNotification & {
  user: Pick<
    User,
    'id' | 'slug' | 'phone' | 'email' | 'emailVerifiedAt' | 'notifyEmailMode' | 'notifyWhatsappMode'
  >
}

// Despacha los avisos pendientes (inmediatos) por canal. Email DIGEST se deja PENDING (lo toma
// el cron de resumen). Reintenta los FAILED hasta MAX_ATTEMPTS y luego se rinde. Los envíos
// fallidos NO tumban el batch: se marcan FAILED y se reintentan el próximo run.
export async function dispatchPendingNotifications(): Promise<{
  sent: number
  failed: number
  skipped: number
}> {
  const rows = (await withRetry(() =>
    prisma.resultNotification.findMany({
      where: {
        OR: [
          // Email: el dispatch solo entrega IMMEDIATE. Las filas de un user DIGEST quedan
          // PENDING para el cron de resumen; NO deben traerse acá, o se re-leerían en cada run
          // del sync (cada hora) hasta el día siguiente y, con take=300 ordenado por detectedAt,
          // podrían desplazar avisos IMMEDIATE más nuevos de otros users (inanición).
          {
            emailStatus: { in: ['PENDING', 'FAILED'] },
            emailAttempts: { lt: MAX_ATTEMPTS },
            user: { notifyEmailMode: 'IMMEDIATE' },
          },
          // WhatsApp no tiene modo diferido: el dispatch siempre lo resuelve a terminal
          // (SENT/SKIPPED/FAILED) en el run que lo toma, así que no causa re-lecturas.
          { whatsappStatus: { in: ['PENDING', 'FAILED'] }, whatsappAttempts: { lt: MAX_ATTEMPTS } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            slug: true,
            phone: true,
            email: true,
            emailVerifiedAt: true,
            notifyEmailMode: true,
            notifyWhatsappMode: true,
          },
        },
      },
      orderBy: { detectedAt: 'asc' },
      take: 300,
    })
  )) as DispatchRow[]

  if (rows.length === 0) return { sent: 0, failed: 0, skipped: 0 }

  // Toggles vigentes del favorito (puede haberse silenciado/quitado desde la detección).
  const favMap = await loadFavoriteToggles(rows.map((r) => ({ userId: r.userId, nameKey: r.nameKey })))
  const windowCache = new Map<string, boolean>()

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of rows) {
    const u = row.user
    const fav = favMap.get(favKey(row.userId, row.nameKey))
    const view = toView(row)
    const patch: Prisma.ResultNotificationUpdateInput = {}

    // --- Email ---
    if (channelRetryable(row.emailStatus, row.emailAttempts)) {
      const mode = effectiveEmailMode(u)
      if (mode === 'IMMEDIATE' && fav?.notifyEmail && u.email) {
        try {
          await sendResultNotificationEmail({
            to: u.email,
            notification: view,
            appUrl: baseUrl(),
            settingsUrl: settingsUrl(u.slug),
          })
          patch.emailStatus = 'SENT'
          patch.emailSentAt = new Date()
          sent++
        } catch (e) {
          patch.emailStatus = 'FAILED'
          patch.emailAttempts = { increment: 1 }
          failed++
          console.error(`[notif] email falló (${row.id}):`, errMsg(e))
        }
      } else if (mode === 'DIGEST' && fav?.notifyEmail) {
        // Queda PENDING: lo arma y envía el cron de resumen diario. No tocar.
      } else {
        patch.emailStatus = 'SKIPPED' // off / sin verificar / silenciado / favorito quitado
        skipped++
      }
    }

    // --- WhatsApp ---
    if (channelRetryable(row.whatsappStatus, row.whatsappAttempts)) {
      const mode = effectiveWhatsappMode(u)
      if (mode === 'IMMEDIATE' && fav?.notifyWhatsapp) {
        try {
          const open = await windowOpenCached(u.phone, windowCache)
          if (open) {
            await sendText({ to: u.phone, body: whatsappFreeText(view, `${baseUrl()}${bracketPath(view)}`) })
          } else {
            const spec = whatsappTemplateSpec(view)
            await sendTemplate({ to: u.phone, name: spec.name, bodyParams: spec.bodyParams })
          }
          patch.whatsappStatus = 'SENT'
          patch.whatsappSentAt = new Date()
          sent++
        } catch (e) {
          patch.whatsappStatus = 'FAILED'
          patch.whatsappAttempts = { increment: 1 }
          failed++
          console.error(`[notif] whatsapp falló (${row.id}):`, errMsg(e))
        }
      } else {
        patch.whatsappStatus = 'SKIPPED'
        skipped++
      }
    }

    if (Object.keys(patch).length > 0) {
      await withRetry(() => prisma.resultNotification.update({ where: { id: row.id }, data: patch }))
    }
  }

  return { sent, failed, skipped }
}

function channelRetryable(status: ResultNotification['emailStatus'], attempts: number): boolean {
  return status === 'PENDING' || (status === 'FAILED' && attempts < MAX_ATTEMPTS)
}

function favKey(userId: string, nameKey: string): string {
  return `${userId}:${nameKey}`
}

async function loadFavoriteToggles(
  pairs: { userId: string; nameKey: string }[]
): Promise<Map<string, { notifyEmail: boolean; notifyWhatsapp: boolean }>> {
  const userIds = [...new Set(pairs.map((p) => p.userId))]
  const nameKeys = [...new Set(pairs.map((p) => p.nameKey))]
  const favs = await withRetry(() =>
    prisma.favoritePlayer.findMany({
      where: { userId: { in: userIds }, nameKey: { in: nameKeys } },
      select: { userId: true, nameKey: true, notifyEmail: true, notifyWhatsapp: true },
    })
  )
  const map = new Map<string, { notifyEmail: boolean; notifyWhatsapp: boolean }>()
  for (const f of favs) {
    map.set(favKey(f.userId, f.nameKey), { notifyEmail: f.notifyEmail, notifyWhatsapp: f.notifyWhatsapp })
  }
  return map
}

// Ventana de 24h cacheada por phone dentro del run (un user con varios avisos no consulta Kapso
// N veces). Si Kapso falla, asumimos cerrada → se manda el template (siempre entregable).
async function windowOpenCached(phone: string, cache: Map<string, boolean>): Promise<boolean> {
  const cached = cache.get(phone)
  if (cached !== undefined) return cached
  let open = false
  try {
    open = await getWindowOpen(phone)
  } catch (e) {
    console.error(`[notif] no se pudo leer la ventana de ${phone}:`, errMsg(e))
    open = false
  }
  cache.set(phone, open)
  return open
}

// ---------- Resumen diario (cron) ----------

// Arma y envía el resumen por usuario con email DIGEST efectivo: todas las filas PENDING de
// email hasta `cutoff` (cuyo favorito siga notifyEmail). Sin filas, no manda. `cutoff` =
// hoy 00:00 hora de Uruguay (lo calcula el cron). Recupera digests que fallaron días previos.
export async function runDailyDigest(cutoff: Date): Promise<{ users: number; emails: number; results: number }> {
  const users = await withRetry(() =>
    prisma.user.findMany({
      where: { notifyEmailMode: 'DIGEST', emailVerifiedAt: { not: null }, email: { not: null } },
      select: { id: true, slug: true, email: true },
    })
  )

  let emails = 0
  let results = 0

  for (const u of users) {
    const rows = await withRetry(() =>
      prisma.resultNotification.findMany({
        where: {
          userId: u.id,
          emailStatus: 'PENDING',
          emailAttempts: { lt: MAX_ATTEMPTS },
          detectedAt: { lt: cutoff },
        },
        orderBy: { detectedAt: 'asc' },
      })
    )
    if (rows.length === 0) continue

    // Solo las de favoritos que siguen con email activo; las del resto se marcan SKIPPED.
    const nameKeys = [...new Set(rows.map((r) => r.nameKey))]
    const active = await withRetry(() =>
      prisma.favoritePlayer.findMany({
        where: { userId: u.id, nameKey: { in: nameKeys }, notifyEmail: true },
        select: { nameKey: true },
      })
    )
    const allowed = new Set(active.map((f) => f.nameKey))
    const toSend = rows.filter((r) => allowed.has(r.nameKey))
    const toSkip = rows.filter((r) => !allowed.has(r.nameKey))

    if (toSkip.length > 0) {
      await withRetry(() =>
        prisma.resultNotification.updateMany({
          where: { id: { in: toSkip.map((r) => r.id) } },
          data: { emailStatus: 'SKIPPED' },
        })
      )
    }

    if (toSend.length === 0 || !u.email) continue

    await sendDailyDigestEmail({
      to: u.email,
      items: toSend.map(toView),
      appUrl: baseUrl(),
      settingsUrl: settingsUrl(u.slug),
    })
    await withRetry(() =>
      prisma.resultNotification.updateMany({
        where: { id: { in: toSend.map((r) => r.id) } },
        data: { emailStatus: 'SENT', emailSentAt: new Date() },
      })
    )
    emails++
    results += toSend.length
  }

  return { users: users.length, emails, results }
}

// ---------- Página de notificaciones (UI) ----------

export type NotificationSettings = {
  emailMode: User['notifyEmailMode']
  whatsappMode: User['notifyWhatsappMode']
  emailVerified: boolean
  favorites: { nameKey: string; name: string; notifyEmail: boolean; notifyWhatsapp: boolean }[]
}

export async function getNotificationSettings(userId: string): Promise<NotificationSettings | null> {
  const user = await withRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        notifyEmailMode: true,
        notifyWhatsappMode: true,
        emailVerifiedAt: true,
        favoritePlayers: {
          orderBy: { name: 'asc' },
          select: { nameKey: true, name: true, notifyEmail: true, notifyWhatsapp: true },
        },
      },
    })
  )
  if (!user) return null
  return {
    emailMode: user.notifyEmailMode,
    whatsappMode: user.notifyWhatsappMode,
    emailVerified: !!user.emailVerifiedAt,
    favorites: user.favoritePlayers,
  }
}

export async function setUserNotifyModes(
  userId: string,
  modes: { emailMode?: User['notifyEmailMode']; whatsappMode?: User['notifyWhatsappMode'] }
): Promise<void> {
  await withRetry(() =>
    prisma.user.update({
      where: { id: userId },
      data: {
        ...(modes.emailMode !== undefined ? { notifyEmailMode: modes.emailMode } : {}),
        ...(modes.whatsappMode !== undefined ? { notifyWhatsappMode: modes.whatsappMode } : {}),
      },
    })
  )
}

export async function setFavoriteChannel(
  userId: string,
  nameKey: string,
  toggles: { notifyEmail?: boolean; notifyWhatsapp?: boolean }
): Promise<void> {
  await withRetry(() =>
    prisma.favoritePlayer.updateMany({
      where: { userId, nameKey },
      data: {
        ...(toggles.notifyEmail !== undefined ? { notifyEmail: toggles.notifyEmail } : {}),
        ...(toggles.notifyWhatsapp !== undefined ? { notifyWhatsapp: toggles.notifyWhatsapp } : {}),
      },
    })
  )
}

// ---------- Nudge ----------

export type NudgeReason = 'no-channel' | 'no-email'

// El nudge aparece si el dueño tiene ≥1 favorito y (ningún canal efectivo activo O email sin
// verificar), y no lo descartó. Distinto del banner de email (auth). Devuelve el motivo para
// elegir el copy, o null si no corresponde. Decisión grill-me.
export async function getNotifyNudgeState(userId: string): Promise<NudgeReason | null> {
  const user = await withRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailVerifiedAt: true,
        notifyEmailMode: true,
        notifyWhatsappMode: true,
        notifyNudgeDismissedAt: true,
        _count: { select: { favoritePlayers: true } },
      },
    })
  )
  if (!user || user.notifyNudgeDismissedAt || user._count.favoritePlayers === 0) return null
  const noChannel = effectiveEmailMode(user) === 'OFF' && effectiveWhatsappMode(user) === 'OFF'
  if (noChannel) return 'no-channel'
  if (!user.emailVerifiedAt) return 'no-email'
  return null
}

export async function dismissNotifyNudge(userId: string): Promise<void> {
  await withRetry(() =>
    prisma.user.update({ where: { id: userId }, data: { notifyNudgeDismissedAt: new Date() } })
  )
}

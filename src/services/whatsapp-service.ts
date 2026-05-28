import { WhatsAppClient, buildKapsoFields } from '@kapso/whatsapp-cloud-api'
import type { ConversationRecord, MetaMessage } from '@kapso/whatsapp-cloud-api'
import {
  AUTH_MESSAGE_REGEX,
  AUTH_FALLBACK_REGEX,
  WA_LOGIN_PREFIX,
  WA_REJECTION_MESSAGE,
  WA_REJECTION_RATE_LIMIT_COUNT,
  WA_REJECTION_RATE_LIMIT_WINDOW_MIN,
  WA_SUCCESS_MESSAGE,
} from '@/lib/constants/auth'

// Única capa que habla con Kapso (mismo principio que "solo services toca Prisma").
// No persistimos nada: Kapso es la fuente de verdad de conversaciones/mensajes.
// Patrón de service: funciones, sin clases, lanzan errores (las actions los capturan).

const KAPSO_PROXY_BASE = 'https://api.kapso.ai/meta/whatsapp'
const KAPSO_PLATFORM_BASE = 'https://api.kapso.ai/platform/v1'
const WINDOW_MS = 24 * 60 * 60 * 1000 // ventana de 24h de Meta

// `buildKapsoFields()` por defecto solo trae campos de mensaje; los de conversación
// (last_inbound_at, etc.) hay que pedirlos explícitos o vienen undefined.
const CONVERSATION_FIELDS = [
  'contact_name',
  'last_inbound_at',
  'last_outbound_at',
  'last_message_text',
  'last_message_timestamp',
]

// ---------- Tipos del dominio (mapeo de lo que da Kapso) ----------

export type WhatsAppConversation = {
  id: string
  phone: string
  contactName: string | null
  status: string | null // 'active' | 'ended'
  lastInboundAt: Date | null
  lastMessageText: string | null
  lastMessageAt: Date | null
  windowOpen: boolean
}

export type WhatsAppMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  timestamp: Date
}

export type HealthCheck = { name: string; passed: boolean; error: string | null }

export type WhatsAppNumberStatus = {
  phoneNumberId: string
  displayName: string | null
  displayPhoneNumber: string | null
  kind: string | null
  qualityRating: string | null
  wabaReviewStatus: string | null
  health: 'healthy' | 'unhealthy' | 'unknown'
  paymentMethodOk: boolean | null
  checks: HealthCheck[]
  billingUrl: string
}

// ---------- Helpers internos ----------

function apiKey(): string {
  const key = process.env.KAPSO_API_KEY
  if (!key) throw new Error('KAPSO_API_KEY no está configurado')
  return key
}

function phoneNumberId(): string {
  const id = process.env.KAPSO_PHONE_NUMBER_ID
  if (!id) throw new Error('KAPSO_PHONE_NUMBER_ID no está configurado')
  return id
}

function client(): WhatsAppClient {
  return new WhatsAppClient({ baseUrl: KAPSO_PROXY_BASE, kapsoApiKey: apiKey() })
}

// Fetch a la API de plataforma de Kapso (health/metadata no están en el SDK).
// Devuelve el body crudo: ojo que algunos endpoints envuelven en `data` (number)
// y otros responden el objeto directo (health) — el caller desenvuelve si hace falta.
async function platformGet<T>(path: string): Promise<T> {
  const res = await fetch(`${KAPSO_PLATFORM_BASE}${path}`, {
    headers: { 'X-API-Key': apiKey() },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Kapso ${path} devolvió ${res.status}`)
  return (await res.json()) as T
}

function billingUrl(): string {
  const projectId = process.env.KAPSO_PROJECT_ID
  return projectId ? `https://app.kapso.ai/projects/${projectId}/billing` : 'https://app.kapso.ai'
}

// Kapso entrega los teléfonos sin '+'; comparamos por dígitos.
function digits(phone: string): string {
  return phone.replace(/\D/g, '')
}

// Las conversaciones traen timestamps ISO; los mensajes pueden venir en unix-segundos.
function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null
  if (/^\d+$/.test(value)) return new Date(Number(value) * 1000)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function isWindowOpen(lastInboundAt: Date | null): boolean {
  return !!lastInboundAt && Date.now() - lastInboundAt.getTime() < WINDOW_MS
}

// Marca mensajes que pertenecen al flujo de auth (Magic-link inverso), para esconderlos
// del inbox del admin. Ver docs/context.md § "Inbox" y ADR 0002.
export function isAuthMessage(body: string | null | undefined): boolean {
  if (!body) return false
  // Lo más fuerte primero: prefijo + 6 chars del charset. Si está editado y el prefijo no
  // aparece pero quedó el code suelto, también lo escondemos (consistente con el webhook).
  const trimmed = body.trim()
  if (trimmed.toLowerCase().startsWith(WA_LOGIN_PREFIX.toLowerCase())) return true
  if (AUTH_MESSAGE_REGEX.test(trimmed)) return true
  // Solo el code (sin prefijo) → escondemos solo si es exactamente eso (evita falsos positivos).
  if (AUTH_FALLBACK_REGEX.test(trimmed) && /^[A-HJ-NP-Z2-9]{6}$/.test(trimmed)) return true
  return false
}

function mapConversation(c: ConversationRecord): WhatsAppConversation {
  const lastInboundAt = parseDate(c.kapso?.lastInboundAt)
  return {
    id: c.id,
    phone: c.phoneNumber ?? '',
    contactName: c.kapso?.contactName ?? null,
    status: c.status ?? null,
    lastInboundAt,
    lastMessageText: c.kapso?.lastMessageText ?? null,
    lastMessageAt: parseDate(c.kapso?.lastMessageTimestamp) ?? parseDate(c.lastActiveAt),
    windowOpen: isWindowOpen(lastInboundAt),
  }
}

function mapMessage(m: MetaMessage): WhatsAppMessage {
  const direction = m.kapso?.direction === 'outbound' ? 'outbound' : 'inbound'
  const content = typeof m.kapso?.content === 'string' ? (m.kapso.content as string) : ''
  return {
    id: m.id,
    direction,
    body: m.text?.body ?? content ?? '',
    timestamp: parseDate(m.timestamp) ?? new Date(0),
  }
}

// ---------- API del service ----------

// Conversaciones del número, más recientes primero.
export async function listConversations(): Promise<WhatsAppConversation[]> {
  const res = await client().conversations.list({
    phoneNumberId: phoneNumberId(),
    limit: 50,
    fields: buildKapsoFields(CONVERSATION_FIELDS),
  })
  return res.data
    .map(mapConversation)
    .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
}

// Mensajes de una conversación, en orden cronológico (más viejo primero).
// Filtra los mensajes del flujo Magic-link inverso (auth-noise) para que el
// inbox del admin sólo vea conversaciones humanas.
export async function getThread(conversationId: string): Promise<WhatsAppMessage[]> {
  const res = await client().messages.listByConversation({
    phoneNumberId: phoneNumberId(),
    conversationId,
    limit: 100,
    fields: buildKapsoFields(),
  })
  return res.data
    .map(mapMessage)
    .filter((m) => !isAuthMessage(m.body))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

// Envío de texto libre. Solo permitido dentro de la ventana de 24h (free-form, gratis).
// Fuera de ventana lanza; si Meta igual rechaza (131047), el SDK lanza con su mensaje.
export async function sendText(input: { to: string; body: string }): Promise<void> {
  const { to, body } = input
  const pid = phoneNumberId()

  const found = await client().conversations.list({
    phoneNumberId: pid,
    phoneNumber: digits(to),
    limit: 1,
    fields: buildKapsoFields(CONVERSATION_FIELDS),
  })
  const convo = found.data[0]
  if (!convo || !isWindowOpen(parseDate(convo.kapso?.lastInboundAt))) {
    throw new Error('La ventana de 24h está cerrada: el contacto debe escribir primero.')
  }

  await client().messages.sendText({ phoneNumberId: pid, to, body })
}

// Rate limit in-memory por phone para sendRejectionFeedback: evita spam si alguien
// manda muchos codes malos en ráfaga. Por instancia (Fluid Compute puede tener varias);
// suficiente para el piloto. Si hace falta global, mover a Redis o tabla DB.
const rejectionTimestamps = new Map<string, number[]>()

function canSendRejection(phone: string): boolean {
  const windowMs = WA_REJECTION_RATE_LIMIT_WINDOW_MIN * 60 * 1000
  const cutoff = Date.now() - windowMs
  const recent = (rejectionTimestamps.get(phone) ?? []).filter((t) => t > cutoff)
  if (recent.length >= WA_REJECTION_RATE_LIMIT_COUNT) {
    rejectionTimestamps.set(phone, recent)
    return false
  }
  recent.push(Date.now())
  rejectionTimestamps.set(phone, recent)
  return true
}

// Responde por WhatsApp al usuario tras un rechazo de auth (code inválido/expirado/etc).
// Free-form gratis: la ventana está abierta porque el usuario acaba de mandar inbound.
// No bloquea el flujo del webhook: capturamos el error y solo logueamos.
export async function sendRejectionFeedback(phone: string): Promise<void> {
  if (!canSendRejection(phone)) {
    console.log(`[whatsapp] rejection feedback rate-limited for ${phone}`)
    return
  }
  try {
    await client().messages.sendText({
      phoneNumberId: phoneNumberId(),
      to: phone,
      body: WA_REJECTION_MESSAGE,
    })
  } catch (err) {
    // No queremos romper el webhook por un saliente fallido. Logueamos.
    console.error('[whatsapp] sendRejectionFeedback failed:', err)
  }
}

// Acknowledge tras un match exitoso: cierre visual en WhatsApp para que el usuario
// sepa que tiene que volver a la pestaña web (donde el polling termina el login).
// Free-form gratis (ventana abierta por el propio inbound). No bloquea el webhook.
export async function sendSuccessFeedback(phone: string): Promise<void> {
  try {
    await client().messages.sendText({
      phoneNumberId: phoneNumberId(),
      to: phone,
      body: WA_SUCCESS_MESSAGE,
    })
  } catch (err) {
    console.error('[whatsapp] sendSuccessFeedback failed:', err)
  }
}

// Estado + salud del número, combinando metadata y el health-check de plataforma.
export async function getNumberStatus(): Promise<WhatsAppNumberStatus> {
  const pid = phoneNumberId()

  type NumberData = {
    display_name: string | null
    display_phone_number: string | null
    kind: string | null
    quality_rating: string | null
    waba_account_review_status: string | null
  }
  type HealthData = {
    status: string
    checks: Record<string, { passed: boolean; error?: string | null }> | null
  }

  const [numberRes, health] = await Promise.all([
    platformGet<{ data: NumberData }>(`/whatsapp/phone_numbers/${pid}`),
    platformGet<HealthData>(`/whatsapp/phone_numbers/${pid}/health`),
  ])
  const number = numberRes.data

  const checks: HealthCheck[] = Object.entries(health.checks ?? {}).map(([name, c]) => ({
    name,
    passed: c.passed,
    error: c.error ?? null,
  }))
  const paymentCheck = checks.find((c) => /payment/i.test(c.name))

  return {
    phoneNumberId: pid,
    displayName: number.display_name,
    displayPhoneNumber: number.display_phone_number,
    kind: number.kind,
    qualityRating: number.quality_rating,
    wabaReviewStatus: number.waba_account_review_status,
    health: health.status === 'healthy' ? 'healthy' : 'unhealthy',
    paymentMethodOk: paymentCheck ? paymentCheck.passed : null,
    checks,
    billingUrl: billingUrl(),
  }
}

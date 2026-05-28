import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  getPendingAuthByCode,
  consumePendingAuth,
  rejectPendingAuth,
} from '@/services/pending-auth-service'
import { upsertUserByPhone } from '@/services/user-service'
import { sendRejectionFeedback, sendSuccessFeedback } from '@/services/whatsapp-service'
import { AUTH_MESSAGE_REGEX, AUTH_FALLBACK_REGEX } from '@/lib/constants/auth'

// Webhook de Kapso (Fase 2 whatsapp-kapso). Recibe inbound messages y resuelve el
// código de sesión del Magic-link inverso. Ver:
//   - docs/PRPs/whatsapp-kapso-prp.md § Per-Task Pseudocode (Flujo Magic-link inverso)
//   - docs/adr/0002-magic-link-inverso-whatsapp.md
//   - .agents/skills/integrate-whatsapp/references/webhooks-{reference,event-types}.md
//
// Política: SIEMPRE responde 200 (incluso ante mensajes irrelevantes o codes inválidos);
// los errores duros (HMAC inválido) devuelven 401. Esto evita reintentos infinitos de
// Kapso por situaciones que no se resuelven con reintento.

// Idempotencia in-memory por waMessageId. Suficiente para el piloto en Fluid Compute:
// si dos instancias procesan el mismo mensaje, la segunda llamada a consumePendingAuth
// igual es no-op (PendingAuth.consumedAt ya seteado, semántica única).
const processedMessageIds = new Set<string>()
const PROCESSED_CACHE_LIMIT = 1000

function rememberMessage(id: string) {
  processedMessageIds.add(id)
  if (processedMessageIds.size > PROCESSED_CACHE_LIMIT) {
    // Evicción simple: vacía la mitad cuando se llena (no necesitamos LRU exacto).
    const arr = Array.from(processedMessageIds)
    arr.slice(0, PROCESSED_CACHE_LIMIT / 2).forEach((k) => processedMessageIds.delete(k))
  }
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  // Comparación constante en tiempo (timingSafeEqual exige misma longitud).
  if (expected.length !== signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

function extractCode(body: string): string | null {
  const match = body.match(AUTH_MESSAGE_REGEX)
  if (match?.[1]) return match[1].toUpperCase()
  const fallback = body.match(AUTH_FALLBACK_REGEX)
  return fallback?.[1] ? fallback[1].toUpperCase() : null
}

// Kapso entrega `phone_number` sin el `+` (ej "59898353507"). Nosotros guardamos
// User.phone en E.164 con `+`. Normalizamos siempre acá para que upsertUserByPhone
// matchee al owner seedeado y no cree un usuario nuevo por cada formato distinto.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

// Forma mínima del payload v2 de Kapso que nos interesa. Otros eventos los ignoramos.
type InboundMessagePayload = {
  event?: string
  message?: {
    id?: string
    type?: string
    text?: { body?: string }
    kapso?: { direction?: string; content?: string }
  }
  conversation?: {
    phone_number?: string
  }
}

export async function POST(req: Request) {
  const secret = process.env.KAPSO_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook/kapso] KAPSO_WEBHOOK_SECRET no está configurado')
    return new NextResponse('Server misconfigured', { status: 500 })
  }

  // Importante: leer el body como texto antes de parsear para verificar la firma sobre los bytes crudos.
  const rawBody = await req.text()
  const signature = req.headers.get('x-webhook-signature')
  if (!verifySignature(rawBody, signature, secret)) {
    console.warn('[webhook/kapso] firma HMAC inválida')
    return new NextResponse('Invalid signature', { status: 401 })
  }

  let payload: InboundMessagePayload
  try {
    payload = JSON.parse(rawBody) as InboundMessagePayload
  } catch {
    return NextResponse.json({ ok: true, ignored: 'invalid-json' })
  }

  // Solo procesamos mensajes entrantes de texto. El resto (status updates, conversation events, etc.) se ignora.
  const isInbound =
    payload.message?.kapso?.direction === 'inbound' ||
    payload.event === 'whatsapp.message.received'
  if (!isInbound) return NextResponse.json({ ok: true, ignored: 'not-inbound' })

  const messageId = payload.message?.id
  if (messageId && processedMessageIds.has(messageId)) {
    return NextResponse.json({ ok: true, ignored: 'duplicate' })
  }
  if (messageId) rememberMessage(messageId)

  const body = payload.message?.text?.body ?? payload.message?.kapso?.content ?? ''
  const phone = normalizePhone(payload.conversation?.phone_number ?? '')
  if (!body || !phone) return NextResponse.json({ ok: true, ignored: 'no-text-or-phone' })

  const code = extractCode(body)
  if (!code) {
    // No es un mensaje de auth — probablemente un humano escribiendo al inbox. Lo dejamos pasar.
    return NextResponse.json({ ok: true, ignored: 'no-auth-code' })
  }

  // A partir de acá hay un code: intentamos resolver el match.
  const pending = await getPendingAuthByCode(code)

  if (!pending) {
    // Código que la web nunca emitió, o ya purgado por el cron.
    await sendRejectionFeedback(phone)
    return NextResponse.json({ ok: true, rejected: 'CODE_INVALID' })
  }

  if (pending.consumedAt) {
    // Reintento idempotente: alguien (Kapso o un duplicado) volvió a entregar el mismo mensaje.
    return NextResponse.json({ ok: true, ignored: 'already-consumed' })
  }

  if (pending.expiresAt < new Date()) {
    await rejectPendingAuth(code, 'CODE_EXPIRED')
    await sendRejectionFeedback(phone)
    return NextResponse.json({ ok: true, rejected: 'CODE_EXPIRED' })
  }

  if (pending.rejectedReason) {
    // Ya fue marcado como inválido previamente — no reactivar.
    await sendRejectionFeedback(phone)
    return NextResponse.json({ ok: true, ignored: 'already-rejected' })
  }

  // Match exitoso: upsert por phone (crea o trae el User) y consume el code.
  const user = await upsertUserByPhone(phone)
  await consumePendingAuth(code, phone, user.id)
  // Acknowledge por WA: el usuario está en su WhatsApp y necesita un cierre visual
  // + el empujón de "volvé a Tenis Tracker" donde el polling termina el login.
  await sendSuccessFeedback(phone)
  return NextResponse.json({ ok: true, consumed: true })
}

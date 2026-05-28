import { randomInt } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import {
  PENDING_AUTH_CHARSET,
  PENDING_AUTH_CODE_LENGTH,
  PENDING_AUTH_TTL_MINUTES,
} from '@/lib/constants/auth'

// Tipos de rechazo que persistimos en PendingAuth.rejectedReason.
// Mismos códigos que devuelve el endpoint de polling al cliente.
export type RejectReason = 'CODE_EXPIRED' | 'CODE_INVALID' | 'CODE_CONSUMED'

// Genera un código aleatorio del charset definido. `randomInt` es CSPRNG.
export function generateAuthCode(): string {
  let out = ''
  for (let i = 0; i < PENDING_AUTH_CODE_LENGTH; i += 1) {
    out += PENDING_AUTH_CHARSET[randomInt(0, PENDING_AUTH_CHARSET.length)]
  }
  return out
}

// Crea un PendingAuth nuevo con código único y expira en TTL minutos.
// Reintenta ante colisión del UNIQUE constraint del code (espacio 32^6 ≈ 10^9: improbable).
export async function createPendingAuth() {
  const expiresAt = new Date(Date.now() + PENDING_AUTH_TTL_MINUTES * 60 * 1000)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateAuthCode()
    try {
      return await prisma.pendingAuth.create({ data: { code, expiresAt } })
    } catch (err) {
      // P2002 = unique violation; reintentamos con un código nuevo.
      const isUnique =
        typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
      if (!isUnique || attempt === 4) throw err
    }
  }
  // Inalcanzable: el loop o devuelve o lanza.
  throw new Error('No se pudo generar un código de sesión único')
}

export async function getPendingAuthByCode(code: string) {
  return prisma.pendingAuth.findUnique({ where: { code } })
}

// Marca el PendingAuth como consumido tras el match exitoso del webhook.
// Idempotente: si ya estaba consumido, no escribe (devuelve la row actual).
export async function consumePendingAuth(code: string, phone: string, userId: string) {
  return prisma.pendingAuth.update({
    where: { code },
    data: { consumedAt: new Date(), resolvedPhone: phone, resolvedUserId: userId },
  })
}

// Marca el PendingAuth como rechazado para que el polling lo refleje en la web.
// No persistimos múltiples intentos: el último gana.
export async function rejectPendingAuth(code: string, reason: RejectReason) {
  return prisma.pendingAuth.update({
    where: { code },
    data: { rejectedReason: reason },
  })
}

// Limpieza de codes expirados hace más de 24h (se ejecuta desde el cron diario).
export async function cleanupExpiredPendingAuths(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const result = await prisma.pendingAuth.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  })
  return result.count
}

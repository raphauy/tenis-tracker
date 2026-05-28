import { NextResponse } from 'next/server'
import { getPendingAuthByCode } from '@/services/pending-auth-service'
import { pendingAuthCodeSchema } from '@/lib/validations/auth'

// Endpoint de polling del flujo Magic-link inverso (Fase 2 whatsapp-kapso).
// La pantalla de espera del login pollea acá con el code que generó la pestaña.
// Ver docs/PRPs/whatsapp-kapso-prp.md § Per-Task Pseudocode.

export type WaAuthRejectReason = 'CODE_EXPIRED' | 'CODE_INVALID' | 'CODE_CONSUMED'

export type WaAuthStatus =
  | { status: 'pending' }
  | { status: 'consumed'; userId: string }
  | { status: 'rejected'; reason: WaAuthRejectReason }

const REJECT_REASONS: WaAuthRejectReason[] = ['CODE_EXPIRED', 'CODE_INVALID', 'CODE_CONSUMED']

function asRejectReason(value: string | null): WaAuthRejectReason {
  return value && (REJECT_REASONS as string[]).includes(value)
    ? (value as WaAuthRejectReason)
    : 'CODE_INVALID'
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const raw = url.searchParams.get('code') ?? ''
  const parsed = pendingAuthCodeSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json<WaAuthStatus>(
      { status: 'rejected', reason: 'CODE_INVALID' },
      { status: 400 },
    )
  }

  const pending = await getPendingAuthByCode(parsed.data)
  if (!pending) {
    return NextResponse.json<WaAuthStatus>({ status: 'rejected', reason: 'CODE_INVALID' })
  }

  if (pending.rejectedReason) {
    return NextResponse.json<WaAuthStatus>({
      status: 'rejected',
      reason: asRejectReason(pending.rejectedReason),
    })
  }

  if (pending.expiresAt < new Date() && !pending.consumedAt) {
    return NextResponse.json<WaAuthStatus>({ status: 'rejected', reason: 'CODE_EXPIRED' })
  }

  if (pending.consumedAt && pending.resolvedUserId) {
    return NextResponse.json<WaAuthStatus>({
      status: 'consumed',
      userId: pending.resolvedUserId,
    })
  }

  return NextResponse.json<WaAuthStatus>({ status: 'pending' })
}

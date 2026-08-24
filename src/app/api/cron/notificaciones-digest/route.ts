import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runDailyDigest } from '@/services/notification-service'
import { withHeartbeat } from '@/lib/cimarron'

// Uruguay es UTC-3 fijo (sin horario de verano).
const UY_OFFSET_MS = 3 * 60 * 60 * 1000

// Instante UTC correspondiente a HOY 00:00 hora de Uruguay. Independiente de la TZ del server
// (opera en epoch ms): el resumen toma todo lo detectado ANTES de este corte.
function uyTodayMidnightUtc(now: Date): Date {
  const uyWall = new Date(now.getTime() - UY_OFFSET_MS) // wall-clock UY visto como UTC
  const midnightUyAsUtc = Date.UTC(uyWall.getUTCFullYear(), uyWall.getUTCMonth(), uyWall.getUTCDate())
  return new Date(midnightUyAsUtc + UY_OFFSET_MS)
}

// Cron (vercel.json, `0 11 * * *` UTC = 8am UY). Envía el resumen diario por email a los users
// con modo DIGEST efectivo: todos los resultados pendientes hasta hoy 00:00 UY. Sin resultados,
// no manda. Vercel inyecta `Authorization: Bearer ${CRON_SECRET}`.
export async function GET(request: NextRequest) {
  // Fail-closed: en producción exige CRON_SECRET (este endpoint envía emails). En dev se permite
  // sin secret para poder probarlo localmente.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 401 })
    }
  } else if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // El latido arranca DESPUÉS de la autorización: un 401 no es una corrida. Si latiera,
  // cualquiera que conozca la ruta del cron mantendría viva la ventana de Cimarrón con
  // el cron muerto.
  return withHeartbeat(process.env.CIMARRON_PING_NOTIFICACIONES_DIGEST, runCron)
}

async function runCron(): Promise<NextResponse> {
  const cutoff = uyTodayMidnightUtc(new Date())
  const result = await runDailyDigest(cutoff)
  return NextResponse.json({ ok: true, cutoff: cutoff.toISOString(), ...result })
}

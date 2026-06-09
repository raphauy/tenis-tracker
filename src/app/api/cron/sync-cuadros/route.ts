import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { syncExternalBrackets } from '@/services/external-bracket-service'

// Cron (vercel.json, cada 6h). Sincroniza los cuadros externos desde sus fuentes.
// Vercel inyecta `Authorization: Bearer ${CRON_SECRET}`.
export async function GET(request: NextRequest) {
  // Fail-closed: en producción exige CRON_SECRET (este endpoint dispara fetches +
  // escritura). En dev se permite sin secret para poder probarlo localmente.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 401 })
    }
  } else if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const report = await syncExternalBrackets()
  return NextResponse.json({ ok: true, ...report })
}

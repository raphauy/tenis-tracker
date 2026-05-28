import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { countPendingVenues } from '@/services/venue-service'
import { countPendingCategories } from '@/services/category-service'
import { countPendingTournaments } from '@/services/tournament-service'
import { getSuperadminEmails } from '@/services/user-service'
import { sendCurationDigestEmail } from '@/services/email-service'
import { cleanupExpiredPendingAuths } from '@/services/pending-auth-service'

// Cron diario (vercel.json). Notifica al superadmin si hay entradas de catálogo
// pendientes de curar. Vercel inyecta `Authorization: Bearer ${CRON_SECRET}`.
export async function GET(request: NextRequest) {
  // Fail-closed: en producción exige CRON_SECRET. Sin secret seteado el endpoint
  // (que manda emails) quedaría público, así que se rechaza. En dev se permite sin
  // secret para poder probarlo localmente.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 401 })
    }
  } else if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Higiene del flujo Magic-link inverso: purgar PendingAuth con expiresAt < now-24h.
  // No bloquea ni cambia el resto del cron; solo logueamos cuántos se borraron.
  const purgedPendingAuths = await cleanupExpiredPendingAuths()

  const [venues, categories, tournaments] = await Promise.all([
    countPendingVenues(),
    countPendingCategories(),
    countPendingTournaments(),
  ])
  const total = venues + categories + tournaments

  // Nada que curar: no se manda email.
  if (total === 0) {
    return NextResponse.json({ sent: false, total: 0, purgedPendingAuths })
  }

  const to = await getSuperadminEmails()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tenis-tracker.app'
  await sendCurationDigestEmail({ to, venues, categories, tournaments, adminUrl: `${baseUrl}/admin` })

  return NextResponse.json({
    sent: to.length > 0,
    total,
    recipients: to.length,
    purgedPendingAuths,
  })
}

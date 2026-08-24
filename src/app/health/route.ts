/**
 * `/health` — el contrato que consume Cimarrón (el monitoreo de la infraestructura,
 * repo aparte) en cada tick de su check `http`.
 *
 * DEVUELVE 200 SIEMPRE QUE PUEDA CONTESTAR, y el estado viaja en el body (ADR 0002
 * de Cimarrón). Una base caída no es un 500 acá: es `db.estado = "error"` con 200,
 * porque el 5xx significa «la app no está» y taparía la diferencia entre la app
 * muerta y la app viva con un pedazo roto.
 *
 * Auth Bearer con token propio, separado de CRON_SECRET: son consumidores distintos
 * y cada uno se revoca solo. FAIL-CLOSED: sin la env var el endpoint responde 401
 * siempre — un /health sin auth es el mapa de las dependencias de la app servido a
 * quien pase.
 *
 * `health` está en RESERVED_SLUGS (src/lib/slug.ts): la ruta gana sobre `/[slug]`
 * por ser estática, pero sin reservarlo alguien podría pedir el perfil `/health` y
 * quedar con un slug que ya no lleva a su página.
 *
 * Contrato y Componentes: docs/dev/health-cimarron.md.
 */

import { NextResponse } from 'next/server'
import { getHealthReport } from '@/services/health-service'

// Nunca cacheado: un /health servido de caché reporta el pasado y el monitoreo se
// queda mirando una foto vieja.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const token = process.env.CIMARRON_HEALTH_TOKEN

  // Misma respuesta falte la env var o sea inválido el header: sin body, sin pistas.
  if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
    return new Response(null, { status: 401 })
  }

  return NextResponse.json(await getHealthReport())
}

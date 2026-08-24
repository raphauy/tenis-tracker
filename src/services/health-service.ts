/**
 * Health Service — las señales que consume el `/health` de Cimarrón.
 *
 * Cimarrón (el monitoreo de la infraestructura, repo aparte) no le pregunta a los
 * terceros: le pregunta a tenis-tracker qué le pasó con ellos. Este service es el que
 * anota esas respuestas y el que después las lee.
 *
 * DOS FORMAS DE COMPONENTE, y las distingue el check de Cimarrón que las recibe,
 * jamás la forma del JSON (spec §5.4):
 *   - ACTIVO (`db`): se mide en el momento del request. Query trivial + latencia.
 *   - PASIVO (el resto): NO se mide en el momento — pegarle a Kapso cada vez que
 *     alguien mira el /health sería tráfico inventado, y encima con las credenciales
 *     de producción. Se reporta lo que dejaron las llamadas reales.
 *
 * QUÉ CUENTA COMO FALLO (decidido en cimarron#30): fallo es «el tercero no sirvió»,
 * no «el request salió mal». Errores de red, timeouts, 5xx, 429/408 y 401/403 son
 * fallo. Un 4xx de pedido mal armado (400, 404, 422) NO registra nada: el tercero
 * contestó, el problema es nuestro, y anotarlo tumbaría el Componente para toda la
 * instalación por un dato viejo de una sola fuente. Del lado de Cimarrón un fallo más
 * nuevo que el último éxito tira el check sin histéresis ni ventana, así que lo que
 * se anota acá alerta directo.
 *
 * La regla exacta vive en `isDependencyFault` (src/lib/cimarron.ts), que es pura y
 * está testeada. Las cuatro credenciales de esta app son de la instalación y no de un
 * usuario, así que acá el 401 siempre es del tercero.
 *
 * Ver docs/dev/health-cimarron.md.
 */

import { prisma, withRetry } from '@/lib/prisma'
import {
  claimFailureWrite,
  claimSuccessWrite,
  createWriteThrottle,
  isDependencyFault,
  truncate,
  type RecordOptions,
} from '@/lib/cimarron'

// =====================
// TIPOS
// =====================

/**
 * Los Componentes pasivos declarados en el alta de tenis-tracker en Cimarrón. La lista es
 * contrato: un Componente declarado que el body no trae marca fallo del lado del
 * central, y uno de más se ignora y se loguea. `db` no está acá porque es activo.
 */
export type PassiveComponent = 'kapso' | 'google-sheets' | 'supabase' | 'resend'

const PASSIVE_COMPONENTS: PassiveComponent[] = [
  'kapso',
  'google-sheets',
  'supabase',
  'resend',
]

/** Componente activo del contrato: `estado` + latencia, o `detalle` si falló. */
export type ActiveComponentReport =
  | { estado: 'ok'; latencia_ms: number }
  | { estado: 'error'; detalle: string }

/** Componente pasivo del contrato: timestamps crudos ISO. La staleness la juzga Cimarrón. */
export type PassiveComponentReport = {
  ultimo_exito: string | null
  ultimo_fallo: string | null
  detalle: string | null
}

export type HealthReport = {
  componentes: Record<string, ActiveComponentReport | PassiveComponentReport>
}

// =====================
// CONSTANTES
// =====================

/**
 * Freno de escrituras, con sus dos ventanas y su interacción, en `cimarron.ts`.
 *
 * Vive en la memoria de la instancia serverless: si la instancia es nueva arranca
 * vacío, escribe y listo. El piso es una escritura por invocación — nunca más que sin
 * el freno.
 */
const writeThrottle = createWriteThrottle()

// =====================
// REGISTRO (lado escritura)
// =====================

/**
 * Anota que el tercero respondió bien.
 *
 * Nunca lanza ni frena al que la llama: si la base está caída, el que se cae es el
 * Componente activo `db`, y hacer fallar una notificación de WhatsApp por no poder
 * anotar que anduvo sería el monitoreo rompiendo lo monitoreado.
 */
export async function recordSuccess(component: PassiveComponent): Promise<void> {
  const now = Date.now()
  if (!claimSuccessWrite(writeThrottle, component, now)) return

  try {
    const at = new Date(now)
    await prisma.dependencyHealth.upsert({
      where: { component },
      create: { component, lastSuccessAt: at },
      update: { lastSuccessAt: at },
    })
  } catch (error) {
    // El turno ya quedó tomado: no se reintenta hasta que venza la ventana. Un éxito
    // perdido no alerta (lo que alerta es un fallo más nuevo), así que no vale la pena.
    console.error(`[health] no se pudo registrar el éxito de ${component}:`, error)
  }
}

/** Anota que el tercero no sirvió. Tampoco lanza. */
export async function recordFailure(
  component: PassiveComponent,
  detail: string
): Promise<void> {
  const now = Date.now()
  if (!claimFailureWrite(writeThrottle, component, now)) return

  const at = new Date(now)
  const lastFailureDetail = truncate(detail)
  try {
    await prisma.dependencyHealth.upsert({
      where: { component },
      create: { component, lastFailureAt: at, lastFailureDetail },
      update: { lastFailureAt: at, lastFailureDetail },
    })
  } catch (error) {
    console.error(`[health] no se pudo registrar el fallo de ${component}:`, error)
  }
}

/**
 * Registra el desenlace de un `fetch` crudo contra el tercero.
 *
 * 2xx ⇒ éxito. 5xx/429/408/401/403 ⇒ fallo. Otro 4xx ⇒ no se registra nada y se
 * loguea: el tercero contestó, el pedido era nuestro problema (ver el encabezado).
 */
export async function recordResponse(
  component: PassiveComponent,
  response: Response,
  options: RecordOptions = {}
): Promise<void> {
  return recordStatus(component, response.status, options)
}

/**
 * Igual que recordResponse pero con el status suelto, para los clientes que ya
 * consumieron la respuesta y solo conservan el código (Resend, que devuelve el
 * `statusCode` en su objeto de error en vez de lanzar).
 */
export async function recordStatus(
  component: PassiveComponent,
  status: number,
  options: RecordOptions = {}
): Promise<void> {
  // El éxito se deriva del status y no se recibe aparte: un par (status, ok) admite
  // estados imposibles, y el que los arme mal se entera cuando ya nadie mira.
  if (status >= 200 && status < 300) return recordSuccess(component)

  const where = options.context ? ` (${options.context})` : ''
  if (!isDependencyFault(status)) {
    console.warn(
      `[health] ${component} respondió ${status}${where}: no cuenta como fallo del tercero`
    )
    return
  }
  return recordFailure(component, `HTTP ${status}${where}`)
}

/** Registra una excepción (red caída, timeout, error del SDK) como fallo. */
export async function recordThrown(
  component: PassiveComponent,
  error: unknown,
  context?: string
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  return recordFailure(component, context ? `${context}: ${message}` : message)
}

// =====================
// REPORTE (lado lectura)
// =====================

/**
 * El body completo del `/health`, con el activo medido y los pasivos leídos.
 *
 * Los dos en paralelo, y con la base caída los dos lo dicen a su manera: `db` reporta
 * `estado: "error"` —ése es el que alerta— y los pasivos salen con los tres campos en
 * null. Eso último NO dispara nada: un null es «sin novedades», y Cimarrón conserva
 * el estado del check en vez de juzgarlo (`leerPasivo` en su `motor/health.ts`).
 *
 * Ojo con confundirlo con la supresión por padre: ésa tapa a los hijos cuando el padre
 * está caído, y acá el padre contestó 200 — está up. `db` y los pasivos son hermanos,
 * así que nadie los suprime; lo que los salva de la falsa alarma es que un null no es
 * evidencia.
 */
export async function getHealthReport(): Promise<HealthReport> {
  const [db, passives] = await Promise.all([checkDatabase(), getPassiveReports()])
  return { componentes: { db, ...passives } }
}

/**
 * Componente activo: query trivial contra la base y cuánto tardó.
 *
 * VA CON `withRetry`, igual que el resto de las lecturas del proyecto. Neon suspende
 * el cómputo con poco tráfico y a veces el arranque en frío falla (`Control plane
 * request failed`, XX000) — es el error que motivó el retry del sync. Sin reintentar,
 * ese tropiezo transitorio se reportaría como `db: error` con la app funcionando
 * perfecto: una falsa alarma recurrente, y encima en el Componente más ruidoso.
 *
 * 2 intentos con 500 ms de espera y no los 3 con 1 s + 2 s del default: el check
 * `http` de Cimarrón corta a los 10 s (`timeout_ms`, su default), y un timeout se lee
 * como la app entera caída — mucho peor que un `db: error`. Si allá se sube el
 * timeout, acá se puede aflojar.
 *
 * La latencia incluye los reintentos a propósito: si hubo que despertar la base, ese
 * tiempo pasó. Ojo con eso al ponerle `umbral` al check del otro lado.
 */
async function checkDatabase(): Promise<ActiveComponentReport> {
  const start = Date.now()
  try {
    await withRetry(() => prisma.$queryRaw`SELECT 1`, 2, 500)
    return { estado: 'ok', latencia_ms: Date.now() - start }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { estado: 'error', detalle: truncate(message) }
  }
}

/**
 * Los pasivos declarados, TODOS, con o sin fila.
 *
 * La lista sale de PASSIVE_COMPONENTS y no de lo que haya en la tabla: un Componente
 * declarado que el body no trae es fallo del lado de Cimarrón, y el que todavía no
 * tuvo una sola llamada tiene que viajar en null, que es «sin tráfico jamás» y no
 * «desapareció».
 */
async function getPassiveReports(): Promise<Record<string, PassiveComponentReport>> {
  let rows: Array<{
    component: string
    lastSuccessAt: Date | null
    lastFailureAt: Date | null
    lastFailureDetail: string | null
  }> = []

  try {
    // Mismo retry que el activo, y por lo mismo: sin él, un arranque en frío de Neon
    // devolvería los cuatro pasivos en null. No alerta (ver getHealthReport), pero
    // perdería la señal de ese tick entero.
    rows = await withRetry(
      () =>
        prisma.dependencyHealth.findMany({
          where: { component: { in: PASSIVE_COMPONENTS } },
        }),
      2,
      500
    )
  } catch (error) {
    console.error('[health] no se pudieron leer los pasivos:', error)
  }

  const byComponent = new Map(rows.map((row) => [row.component, row]))

  return Object.fromEntries(
    PASSIVE_COMPONENTS.map((component) => {
      const row = byComponent.get(component)
      return [
        component,
        {
          ultimo_exito: row?.lastSuccessAt?.toISOString() ?? null,
          ultimo_fallo: row?.lastFailureAt?.toISOString() ?? null,
          // El detalle acompaña al último fallo. Sin fallo no hay detalle que dar.
          detalle: row?.lastFailureAt ? (row.lastFailureDetail ?? null) : null,
        },
      ]
    })
  )
}

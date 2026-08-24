/**
 * Heartbeat de los crons hacia Cimarrón (el monitoreo de la infraestructura, repo
 * aparte).
 *
 * POR QUÉ UN LATIDO Y NO UN CHECK: un cron de Vercel que no corre no falla, no
 * responde y no avisa — no hay nada a lo que pegarle. La única señal posible es que
 * el propio cron diga «corrí». Cimarrón le pone una ventana Period + Grace a cada
 * UUID y el silencio es lo que alerta (spec §5.3). Por eso los crons quedan FUERA
 * del `/health`: su señal es esta y no habría por qué contarla dos veces.
 *
 * UN UUID POR CRON, cada uno en su propia env var `CIMARRON_PING_<CRON>` y revocable
 * de a uno. La URL entera es el secreto: se emite en el dashboard de Cimarrón y no
 * se versiona. Sin la env var, el latido no sale y el cron corre igual — un deploy
 * en preview no tiene por qué pingear la ventana de producción.
 *
 * Y acá vive, además del latido, todo lo que el registro de pasivos del `/health`
 * necesita y que NO toca la base: la regla de clasificación de fallos
 * (`isDependencyFault`), el corte del detalle (`truncate`) y el freno de escrituras.
 * El criterio es ése y no el tema: lo puro se puede testear sin base de datos, y es
 * justo la parte donde un error se paga en alertas perdidas. Lo que toca Prisma vive
 * en `services/health-service.ts`.
 *
 * Ver docs/dev/health-cimarron.md.
 */

/** Un latido que se cuelga no puede colgar al cron que lo emite. */
const PING_TIMEOUT_MS = 5000

/**
 * Largo máximo del detalle de un fallo, para el `/health` y para el body del `/fail`.
 *
 * Vive acá y no en health-service para que los dos caminos corten igual: el detalle
 * viaja al dashboard de Cimarrón, y un stack entero no aporta nada y ensucia.
 */
export const DETAIL_MAX_LENGTH = 300

export function truncate(message: string): string {
  return message.slice(0, DETAIL_MAX_LENGTH)
}

/**
 * Corre el cuerpo del cron y late al terminar, pase lo que pase.
 *
 * QUÉ CUENTA COMO CORRIDA FALLIDA: que el handler lance, o que devuelva 5xx. Un 200
 * con errores adentro (dos fuentes de cinco que no se pudieron sincronizar, y el
 * reporte lo dice) NO es un fallo del cron: el cron corrió. Esos errores ya tienen su
 * propio camino de aviso —el mail de alerta del sync— y meterlos acá haría que el
 * latido midiera dos cosas a la vez.
 *
 * El error se relanza tal cual: el latido es un testigo, no cambia el flujo de nadie.
 */
export async function withHeartbeat(
  pingUrl: string | undefined,
  run: () => Promise<Response>
): Promise<Response> {
  let response: Response
  try {
    response = await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await ping(pingUrl, false, truncate(message))
    throw error
  }

  await ping(pingUrl, response.status < 500, `HTTP ${response.status}`)
  return response
}

async function ping(
  pingUrl: string | undefined,
  ok: boolean,
  detail: string
): Promise<void> {
  if (!pingUrl) return

  try {
    const response = await fetch(ok ? pingUrl : `${pingUrl}/fail`, {
      method: 'POST',
      body: ok ? undefined : detail,
      cache: 'no-store',
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    })
    if (!response.ok) {
      console.error(`[cimarron] el latido fue rechazado con ${response.status}`)
    }
  } catch (error) {
    // Que Cimarrón esté caído no puede tumbar el cron: el silencio ya es la alerta
    // del otro lado. Se loguea y se sigue.
    console.error('[cimarron] no se pudo emitir el latido:', error)
  }
}


// =====================
// CLASIFICACIÓN DE FALLOS DE LOS PASIVOS
// =====================

/**
 * Cómo se lee el desenlace de una llamada a un tercero. Vive acá, y no en
 * health-service, porque es lógica pura: así se puede testear sin base de datos.
 */
export type RecordOptions = {
  /** De dónde salió la llamada, para que el detalle del fallo diga algo. */
  context?: string
}

/**
 * Estados HTTP en los que el TERCERO es el que falló.
 *
 * Fallo es «el tercero no sirvió», no «el request salió mal»: un 4xx de pedido mal
 * armado (400, 404, 422) queda afuera, porque el tercero contestó y el problema es
 * nuestro. Del lado de Cimarrón un fallo más nuevo que el último éxito tumba el check
 * sin histéresis ni ventana, así que anotarlo dejaría el Componente en rojo para toda
 * la instalación por un dato malo de una sola fuente.
 *
 * 401/403 entran a propósito: las cuatro credenciales de esta app (Kapso, Sheets, la
 * anon key de MUR y Resend) son de la INSTALACIÓN y no de un usuario, así que una
 * vencida o revocada es la integración rota y necesita una persona, aunque el
 * servidor del otro lado esté perfecto. El día que aparezca un tercero con token por
 * usuario —un OAuth— va a haber que distinguirlos, y ahí no alcanza con el status.
 */
export function isDependencyFault(status: number): boolean {
  return status >= 500 || status === 429 || status === 408 || status === 401 || status === 403
}

// =====================
// FRENO DE ESCRITURAS DE LOS PASIVOS
// =====================

/**
 * Cada llamada a un tercero querría escribir su fila en `DependencyHealth`, y hay
 * ráfagas: el sync de cuadros baja una hoja por categoría, así que una fuente caída
 * son N upserts seriales sobre la MISMA fila, todos diciendo la misma noticia,
 * adentro del cron. El freno corta la repetición sin perder ninguna señal.
 *
 * Vive acá porque es lógica pura —no toca Prisma— y así se puede testear: es la parte
 * del registro donde un error se paga en alertas perdidas, no en un tipo mal puesto.
 */
export type WriteThrottle = {
  success: Map<string, number>
  failure: Map<string, number>
}

/** Un éxito por Componente por minuto: la noticia buena no cambia tan rápido. */
export const SUCCESS_WINDOW_MS = 60_000

/**
 * Los fallos se frenan MUCHO menos: es la señal que alerta. Diez segundos alcanzan
 * para comerse la ráfaga de un cron y no para tapar un fallo nuevo de verdad.
 */
export const FAILURE_WINDOW_MS = 10_000

export function createWriteThrottle(): WriteThrottle {
  return { success: new Map(), failure: new Map() }
}

/**
 * ¿Escribir este éxito?
 *
 * Al conceder el turno LIBERA el freno de fallos, y eso no es una comodidad: es
 * correctitud. Cimarrón juzga comparando `ultimo_fallo` contra `ultimo_exito`, así
 * que un fallo posterior a esta recuperación que quedara frenado dejaría el check
 * leyéndose como sano mientras el tercero está caído — una alerta perdida, no una
 * demorada.
 *
 * EL PRECIO, QUE ES REAL Y ESTÁ ACEPTADO: contra una ráfaga ALTERNADA —un 429 entre
 * 200, que es la forma del rate limit de Sheets bajando una hoja por categoría— los
 * dos frenos se liberan mutuamente y escribe todas. El freno sólo corta la ráfaga
 * uniforme, que es la del tercero caído de verdad. Se eligió así porque la
 * alternancia es exactamente el caso donde el ORDEN entre éxito y fallo es la señal,
 * y frenar cualquiera de los dos lo falsearía; el costo es volver al comportamiento
 * que había antes del freno, que era la línea base. Está fijado en `cimarron.test.ts`
 * («la ráfaga alternada escribe todas»): si alguien saca alguno de los dos `delete`
 * para "arreglarlo", ese test cae y explica por qué.
 */
export function claimSuccessWrite(
  throttle: WriteThrottle,
  component: string,
  now: number
): boolean {
  if (!expired(throttle.success.get(component), now, SUCCESS_WINDOW_MS)) return false
  throttle.success.set(component, now)
  throttle.failure.delete(component)
  return true
}

/**
 * ¿Escribir este fallo?
 *
 * Simétrico: libera el freno de éxitos para que la recuperación levante el check al
 * instante y no hasta un minuto después. Sin eso, el `ultimo_fallo` quedaría siendo
 * el más nuevo con el tercero ya funcionando: una falsa alarma que dura lo que dure
 * la ventana. Mismo precio en la ráfaga alternada — ver `claimSuccessWrite`.
 */
export function claimFailureWrite(
  throttle: WriteThrottle,
  component: string,
  now: number
): boolean {
  if (!expired(throttle.failure.get(component), now, FAILURE_WINDOW_MS)) return false
  throttle.failure.set(component, now)
  throttle.success.delete(component)
  return true
}

/** Sin marca previa siempre se escribe: el freno de una instancia nueva arranca vacío. */
function expired(mark: number | undefined, now: number, windowMs: number): boolean {
  return mark === undefined || now - mark >= windowMs
}

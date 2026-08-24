import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DETAIL_MAX_LENGTH,
  FAILURE_WINDOW_MS,
  SUCCESS_WINDOW_MS,
  claimFailureWrite,
  claimSuccessWrite,
  createWriteThrottle,
  isDependencyFault,
  withHeartbeat,
} from './cimarron'

// El latido es monitoreo: si se equivoca, el error es silencioso por definición —
// Cimarrón cree que el cron corrió cuando no corrió, o al revés. De ahí los tests.

const PING = 'https://cimarron.test/api/ping/uuid-de-prueba'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function pingedUrls(): string[] {
  return fetchMock.mock.calls.map((call) => call[0] as string)
}

describe('withHeartbeat', () => {
  it('late al terminar bien y devuelve la respuesta del cron', async () => {
    const response = await withHeartbeat(PING, async () => Response.json({ ok: true }))

    expect(pingedUrls()).toEqual([PING])
    expect(await response.json()).toEqual({ ok: true })
  })

  it('el latido de éxito va sin body', async () => {
    await withHeartbeat(PING, async () => new Response(null, { status: 200 }))

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: undefined })
  })

  it('pega en /fail con el motivo cuando el cron lanza, y relanza el error', async () => {
    const boom = new Error('la fuente no contestó')

    await expect(
      withHeartbeat(PING, async () => {
        throw boom
      })
    ).rejects.toThrow(boom)

    expect(pingedUrls()).toEqual([`${PING}/fail`])
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: 'la fuente no contestó' })
  })

  it('el motivo del /fail se trunca igual que el detalle del /health', async () => {
    await expect(
      withHeartbeat(PING, async () => {
        throw new Error('x'.repeat(1000))
      })
    ).rejects.toThrow()

    expect((fetchMock.mock.calls[0][1] as { body: string }).body).toHaveLength(
      DETAIL_MAX_LENGTH
    )
  })

  it('pega en /fail cuando el cron devuelve 5xx', async () => {
    await withHeartbeat(PING, async () => new Response(null, { status: 500 }))

    expect(pingedUrls()).toEqual([`${PING}/fail`])
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: 'HTTP 500' })
  })

  it('un 4xx del cron NO es una corrida fallida', async () => {
    // El handler decidió no hacer nada (por ejemplo, nada que curar). El cron corrió.
    await withHeartbeat(PING, async () => new Response(null, { status: 404 }))

    expect(pingedUrls()).toEqual([PING])
  })

  it('sin URL configurada no late, y el cron corre igual', async () => {
    const response = await withHeartbeat(undefined, async () => Response.json({ ok: true }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({ ok: true })
  })

  it('un latido que falla no tumba al cron', async () => {
    fetchMock.mockRejectedValue(new Error('cimarron caído'))

    const response = await withHeartbeat(PING, async () => Response.json({ ok: true }))

    expect(await response.json()).toEqual({ ok: true })
  })

  it('un latido rechazado tampoco tumba al cron', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    const response = await withHeartbeat(PING, async () => Response.json({ ok: true }))

    expect(await response.json()).toEqual({ ok: true })
  })
})

describe('isDependencyFault', () => {
  it('los errores del servidor y el rate limit son del tercero', () => {
    for (const status of [500, 502, 503, 504, 429, 408]) {
      expect(isDependencyFault(status)).toBe(true)
    }
  })

  it('un pedido mal armado no lo es: el tercero contestó', () => {
    // Una planilla borrada (404), un filtro inválido (400), un payload que Meta
    // rechaza (400 con su código). Nada de eso dice que la fuente esté caída.
    for (const status of [400, 404, 409, 410, 422]) {
      expect(isDependencyFault(status)).toBe(false)
    }
  })

  it('una credencial vencida SÍ es la integración rota', () => {
    // Las cuatro credenciales de esta app son de la instalación, no de un usuario:
    // un 401 no es «este cliente revocó el permiso», es «hay que rotar la key».
    expect(isDependencyFault(401)).toBe(true)
    expect(isDependencyFault(403)).toBe(true)
  })
})

describe('freno de escrituras de los pasivos', () => {
  const T0 = 1_700_000_000_000

  it('el primer éxito y el primero de cada ventana escriben; la ráfaga no', () => {
    const t = createWriteThrottle()

    expect(claimSuccessWrite(t, 'kapso', T0)).toBe(true)
    expect(claimSuccessWrite(t, 'kapso', T0 + 1_000)).toBe(false)
    expect(claimSuccessWrite(t, 'kapso', T0 + SUCCESS_WINDOW_MS)).toBe(true)
  })

  it('cada Componente lleva su propio turno', () => {
    const t = createWriteThrottle()

    expect(claimSuccessWrite(t, 'kapso', T0)).toBe(true)
    expect(claimSuccessWrite(t, 'google-sheets', T0)).toBe(true)
  })

  it('la ráfaga de fallos de un cron se corta, pero con ventana mucho más corta', () => {
    const t = createWriteThrottle()

    // Una fuente caída: un fetch por categoría, todos diciendo lo mismo.
    expect(claimFailureWrite(t, 'google-sheets', T0)).toBe(true)
    expect(claimFailureWrite(t, 'google-sheets', T0 + 200)).toBe(false)
    expect(claimFailureWrite(t, 'google-sheets', T0 + 900)).toBe(false)

    expect(claimFailureWrite(t, 'google-sheets', T0 + FAILURE_WINDOW_MS)).toBe(true)
    expect(FAILURE_WINDOW_MS).toBeLessThan(SUCCESS_WINDOW_MS)
  })

  it('un fallo libera el freno de éxitos: la recuperación levanta el check al instante', () => {
    const t = createWriteThrottle()

    claimSuccessWrite(t, 'supabase', T0)
    expect(claimFailureWrite(t, 'supabase', T0 + 1_000)).toBe(true)

    // Sin liberar, este éxito quedaría frenado hasta T0+60s y el `ultimo_fallo`
    // seguiría siendo el más nuevo: falsa alarma con el tercero ya funcionando.
    expect(claimSuccessWrite(t, 'supabase', T0 + 2_000)).toBe(true)
  })

  it('la ráfaga ALTERNADA escribe todas, y tiene que seguir siendo así', () => {
    // Un 429 entre 200 es la forma del rate limit de Sheets bajando una hoja por
    // categoría. Acá los dos frenos se liberan mutuamente y no cortan nada: 20
    // llamadas, 20 escrituras. Es DELIBERADO, no un agujero.
    //
    // El freno existe para la ráfaga uniforme (el tercero caído de verdad diciendo
    // veinte veces lo mismo). En la alternada, el orden relativo entre `ultimo_exito`
    // y `ultimo_fallo` ES la señal que Cimarrón compara, y frenar cualquiera de los
    // dos lo falsearía: un fallo tapado deja el check sano con el tercero caído.
    //
    // Si este test te molesta y estás por sacar alguno de los `delete` del otro mapa:
    // eso es lo que reintroduce la alerta perdida. El costo de dejarlo es volver al
    // comportamiento previo al freno, que era la línea base aceptada.
    const t = createWriteThrottle()
    let escrituras = 0

    for (let i = 0; i < 20; i++) {
      const ok = i % 2 === 0
      const escribio = ok
        ? claimSuccessWrite(t, 'google-sheets', T0 + i * 100)
        : claimFailureWrite(t, 'google-sheets', T0 + i * 100)
      if (escribio) escrituras++
    }

    expect(escrituras).toBe(20)
  })

  it('la ráfaga UNIFORME sí se corta: es para lo que está el freno', () => {
    const t = createWriteThrottle()
    let escrituras = 0

    // El caso real: Google devolviendo 503 en cada una de las 20 categorías.
    for (let i = 0; i < 20; i++) {
      if (claimFailureWrite(t, 'google-sheets', T0 + i * 100)) escrituras++
    }

    expect(escrituras).toBe(1)
  })

  it('un éxito libera el freno de fallos: no se pierde el fallo que viene después', () => {
    const t = createWriteThrottle()

    claimFailureWrite(t, 'resend', T0)
    claimSuccessWrite(t, 'resend', T0 + 1_000)

    // Este fallo cae dentro de la ventana del anterior. Si se frenara, el último
    // éxito quedaría siendo el más nuevo y el check se leería sano con el tercero
    // caído: una alerta PERDIDA, no demorada.
    expect(claimFailureWrite(t, 'resend', T0 + 2_000)).toBe(true)
  })
})

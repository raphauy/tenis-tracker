# `/health` y latidos de crons — contrato con Cimarrón

Cimarrón es el monitoreo de la infraestructura (repo aparte, `raphauy/cimarron`).
Este documento es el contrato de tenis-tracker con él: qué expone, qué registra y qué
env vars hacen falta. Pedido en [cimarron#30](https://github.com/raphauy/cimarron/issues/30),
contrato en la §5.4 de su spec.

## `GET /health`

**Bearer `CIMARRON_HEALTH_TOKEN`.** Sin el header correcto —o sin la env var
configurada— responde **401 sin body**: fail-closed. Un `/health` abierto es el mapa
de las dependencias de la app servido a quien pase.

**Devuelve 200 siempre que pueda contestar**, y el estado viaja en el body (ADR 0002
de Cimarrón). Una base caída NO es un 500 acá: el 5xx significa «la app no está» y
taparía la diferencia entre la app muerta y la app viva con un pedazo roto.

```json
{
  "componentes": {
    "db":            { "estado": "ok", "latencia_ms": 12 },
    "kapso":         { "ultimo_exito": "2026-08-24T14:02:10Z", "ultimo_fallo": null, "detalle": null },
    "google-sheets": { "ultimo_exito": "2026-08-24T13:00:04Z", "ultimo_fallo": null, "detalle": null },
    "supabase":      { "ultimo_exito": "2026-08-24T13:00:07Z", "ultimo_fallo": null, "detalle": null },
    "resend":        { "ultimo_exito": "2026-08-24T11:00:41Z", "ultimo_fallo": null, "detalle": null }
  }
}
```

Los cinco Componentes se declaran del lado de Cimarrón al dar de alta la app. Uno
declarado que el body no traiga marca **fallo**; uno de más se ignora y se loguea.
Cambiar esta lista es cambiar el alta, no solo el código.

### El check del `/health` va con ventana horaria y cadencia propia

**No es cosmética: es el costo de Neon.** El `/health` toca la base dos veces por tick
—el `SELECT 1` del activo y el `findMany` de los pasivos—, y el autosuspend de Neon
por defecto es de 5 minutos. Un check que consulta cada 5 minutos no deja que ese
temporizador venza nunca, así que el cómputo queda despierto de punta a punta: el
monitoreo cambiaría la economía de lo monitoreado.

La ventana horaria de Cimarrón **no ejecuta** el check fuera de franja
(`scheduler.ts:110-111` corta antes del request), así que de noche no hay ni HTTP ni
query y Neon se suspende como siempre:

```json
"ventana": { "desde": "07:00", "hasta": "01:00", "tz": "America/Montevideo" },
"cadencia": "20m"
```

La ventana sola no alcanza: en las horas abiertas el tick por defecto es de 5 minutos
y el temporizador de Neon sigue sin vencer. Por eso va también **`cadencia`** —que
cimarron#30 agregó a los checks `http`, espejo de la que ya tenía la sonda—: con más
minutos entre tick y tick que los 5 del autosuspend, la base se duerme en el medio.

**La cuenta, para que no derive.** Cada tick despierta el cómputo y lo deja prendido
los 5 minutos del autosuspend; mientras la cadencia sea mayor que eso, las ventanas de
actividad no se solapan y el cálculo es directo:

```
ticks/día      = horas abiertas × 60 ÷ cadencia
cómputo/día    = ticks/día × 5 min
```

| Config | Ticks/día | Cómputo/día |
|---|---|---|
| Sin ventana, cadencia `normal` (5 min) | 288 | **~24 h** — el temporizador no vence nunca |
| Ventana 18 h + `20m` | 54 | **4,5 h** |
| Ventana 18 h + `30m` | 36 | **3 h** |
| Ventana 18 h + `60m` | 18 | **1,5 h** |

Hoy va con **`20m` ⇒ 4,5 h/día**. Los números son del `/health` solo: el tráfico real
de usuarios y los tres crons **se suman arriba**, no se restan. De referencia, los
crons por su cuenta son ~19 corridas/día ⇒ ~1,6 h.

Lo que se paga por alargar la cadencia es detección, y se paga contra la histéresis: a
20 minutos, los 3 fallos del default son una hora hasta declarar la caída. Para esta
app alcanza; si algún día no alcanza, se baja sabiendo lo que cuesta.

El otro precio es el que la spec §4 ya acepta: *«de noche no se sondea: un fallo nocturno
se descubre a las 07:00, y alcanza»*. Y no arrastra ningún efecto raro — verificado
contra el motor: el hijo `db` es un check `metric`, que el scheduler **no** ejecuta
nunca (es puro push), y los cuatro pasivos van sin Period + Grace, que es la rama que
`evaluarDeadMan` saltea. Ninguno puede caer por el silencio de la franja cerrada. Al
reabrir, `rachaVigente` arranca la histéresis de cero, así que tampoco aparece un
fallo pendiente de anoche.

`health` está en `RESERVED_SLUGS` (`src/lib/slug.ts`) y con short-circuit en
`src/proxy.ts`. Lo primero, para que nadie se quede con un slug de perfil que ya no
lleva a su página; lo segundo, porque sin él el proxy le devolvería un redirect a
`/login` — que el monitoreo leería como la app contestando 200 con HTML.

### Activo vs pasivo

- **`db` es activo**: se mide en el momento del request (query trivial + latencia).
  En error viaja `detalle` truncado en lugar de `latencia_ms`.
- **El resto son pasivos**: NO se miden en el momento. Pegarle a Kapso cada vez que
  alguien mira el `/health` sería tráfico inventado, y encima con las credenciales de
  producción. Se reporta lo que dejaron las llamadas **reales** de la app, guardado en
  la tabla `DependencyHealth` — serverless no retiene memoria entre invocaciones.
- Los timestamps van **crudos**. **La staleness la juzga Cimarrón**: el umbral vive en
  la config de su check, así cambiar la política nunca toca a esta app y el reloj que
  compara es siempre el mismo.
- Sin tráfico jamás ⇒ los tres campos en `null`. Un pasivo viejo queda stale y, si no
  tiene ventana configurada del otro lado, no alerta.

### Qué cuenta como fallo del tercero

Fallo es **«el tercero no sirvió»**, no «el request salió mal». La regla vive en
`isDependencyFault` (`src/lib/cimarron.ts`), que es pura y está testeada:

| Desenlace | Se registra |
|---|---|
| 2xx | éxito |
| Error de red / timeout | fallo |
| 5xx, 429, 408 | fallo |
| 401 / 403 | fallo — las cuatro credenciales son de la instalación, no de un usuario |
| Otro 4xx (400, 404, 410, 422) | nada, solo log |

El último es el que importa: una planilla borrada (404), un filtro que quedó viejo
(400) o un mensaje que Meta rechaza por ventana cerrada (400 con su código) **no**
dicen que la fuente esté caída. Del lado de Cimarrón, un fallo más nuevo que el último
éxito tumba el check **sin histéresis ni ventana**, así que anotarlos dejaría el
Componente en rojo hasta la próxima llamada exitosa — que en `curation` es 24 h.

Que el 401 sea siempre del tercero vale **porque acá ninguna credencial es de un
usuario**. El día que aparezca un OAuth por persona hay que distinguirlos: un cliente
que revoca su permiso no puede tumbar el Componente para todos los demás. En onmind ya
pasa con `google-calendar`, y ahí la salvedad viaja por llamada.

### Dónde se registra cada Componente

| Componente | Punto instrumentado |
|---|---|
| `kapso` | `whatsapp-service.ts` → el `fetch` propio que se le pasa al SDK, más `platformGet` |
| `google-sheets` | `cuadros/adapters/google-sheets-academia/index.ts` → `sheetsFetch` (API v4 y export CSV) |
| `supabase` | `cuadros/adapters/mur-supabase/index.ts` → `murGet` |
| `resend` | `email-service.ts`, envolviendo al cliente: todos los `send` del archivo pasan por ahí |

Kapso se instrumenta por el `fetch` del SDK y no método por método: así **toda**
llamada deja señal, incluidas las que se agreguen después. Y registra por **status**,
no por «lanzó o no»: el SDK lanza un `GraphApiError` también cuando Meta rechaza el
mensaje (131047, ventana de 24 h cerrada), que llega como 400 y no es Kapso caído.

Resend no lanza cuando la API rechaza: devuelve `error` con su `statusCode`. Por eso
el wrapper lo mira — sin él, un 5xx de Resend se iba en silencio.

## Latidos de los crons

Los 3 crons de `vercel.json` **no** están en el `/health`: su señal única es el latido
(spec §5.3 de Cimarrón), para que no haya doble alerta. Un cron de Vercel que no corre
no falla, no responde y no avisa — la única señal posible es que él mismo diga «corrí».

Cada cron llama a `withHeartbeat` (`src/lib/cimarron.ts`) **después** de verificar el
`CRON_SECRET`: un 401 no es una corrida, y si latiera, cualquiera que conozca la ruta
mantendría viva la ventana de Cimarrón con el cron muerto.

- **Éxito** = el handler devolvió menos de 500.
- **Fallo** = el handler lanzó o devolvió 5xx ⇒ `POST …/fail` con el motivo en el body.
- Que Cimarrón esté caído nunca tumba un cron: el latido se loguea y se sigue.

**`sync-cuadros` (`0 0-3,11-23 * * *`) duerme de 04:00 a 10:59 UTC**, así que su check
necesita **ventana horaria** del lado de Cimarrón o el dead-man's switch lo cobra todas
las mañanas. Es config del alta, no de la app: la ventana la conoce el central, que es
el que juzga el silencio.

Ninguno de los tres corre cada minuto, así que el helper no trae el espaciado del
latido de éxito que sí usa onmind (uno de cada cinco corridas, cimarron#40). Si algún
día aparece un cron por minuto, hay que agregarlo — y mover su check a period 5m +
grace 5m.

## Env vars

Todas en Vercel (production). Sin ellas la app corre igual: el `/health` responde 401
y los crons no latan — un preview no tiene por qué pingear la ventana de producción.

| Env var | Para qué |
|---|---|
| `CIMARRON_HEALTH_TOKEN` | Bearer del `/health`. Propio, separado de `CRON_SECRET` |
| `CIMARRON_PING_CURATION` | URL de latido de `/api/cron/curation` |
| `CIMARRON_PING_SYNC_CUADROS` | `/api/cron/sync-cuadros` |
| `CIMARRON_PING_NOTIFICACIONES_DIGEST` | `/api/cron/notificaciones-digest` |

**La URL de latido es el secreto entero** (`https://cimarron.raphauy.dev/api/ping/<uuid>`),
se emite en el dashboard de Cimarrón y no se versiona. Una por cron, revocable de a
una: rotar un UUID es emitirlo de nuevo y cambiar su env var.

## Probarlo a mano

```bash
curl -s -H "Authorization: Bearer $CIMARRON_HEALTH_TOKEN" https://<dominio>/health | jq
curl -si https://<dominio>/health | head -1   # 401 sin token
```

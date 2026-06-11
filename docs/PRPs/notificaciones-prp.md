# PRP: Notificaciones de resultados

**Glosario:** [`docs/context.md`](../context.md) § "Notificaciones de resultados" (Seguir = Favorito, Notificación de resultado, Favorito notificable/silenciado, Modo de email).
**Depende de:** feature **cuadros** ([`cuadros-prp.md`](./cuadros-prp.md)) — los resultados salen de `ExternalBracket.data`; el motor se engancha en el sync. Y de la integración **whatsapp-kapso** ([`whatsapp-kapso-prp.md`](./whatsapp-kapso-prp.md)) — el envío de templates.
**Estado:** Diseño cerrado + detalle de implementación (`grill-me` 2026-06-10). Listo para plan mode.

> El usuario ya usa los favoritos de `/cuadros` para resaltar amigos **y** rivales conocidos. La feature agrega avisos **sin** tocar ese uso visual: un favorito puede estar silenciado y seguir resaltado.

---

## Goal

Avisar al **dueño de un Favorito** cuando ese nombre registra un **resultado nuevo** en un **cuadro externo** (`/cuadros`), por **email** y/o **WhatsApp**, con un sistema **muy configurable** (canal, modo, y on/off por favorito y por canal) y **defaults inteligentes** según los datos de contacto que tenga el usuario.

Reusa todo lo existente: los **Favoritos** (`FavoritePlayer`, por nombre normalizado), el **sync de cuadros** (cron) como disparador, el **email-service** (Resend) y los **templates de WhatsApp** (Kapso). No introduce una fuente de datos nueva.

## Why

- El dueño quiere enterarse de cómo les va a sus **amigos** en los torneos, sin entrar a mirar el cuadro a cada rato.
- Pero marca como favoritos también a **rivales conocidos** (solo para verlos resaltados): no quiere que esos lo molesten. → hace falta granularidad **por favorito y por canal**.
- Conecta piezas que ya están pero no se hablaban: favoritos ↔ sync de cuadros ↔ email/WhatsApp. Es el primer uso **proactivo** (business-initiated) de los templates de WhatsApp, justo lo que la feature whatsapp-kapso dejó como post-feature.

## What

Una sola fase con cuatro bloques:

1. **Schema completo** (migración única): preferencias de canal en `User`, toggles por canal en `FavoritePlayer`, y la **bandeja de salida** `ResultNotification`.
2. **Motor de detección** enganchado al sync: diff del cuadro viejo↔nuevo → partidos que pasaron a jugado → cruce con favoritos → filas en la bandeja → dispatch.
3. **Canales:** `email-service` (resumen diario + inmediato, con React Email) y `whatsapp-service.sendTemplate` (4 templates UTILITY).
4. **UI:** página dedicada de notificaciones (modos globales + lista de favoritos con toggles por canal) + aviso al verificar email + cambio de cadencia del sync.

### Success Criteria

- [ ] Cuando un favorito **notificable** registra un resultado nuevo en un cuadro, el dueño recibe el aviso por sus canales activos (email y/o WhatsApp), **una sola vez** por partido.
- [ ] Un favorito **silenciado** (por canal) sigue resaltado en `/cuadros` pero **no** dispara ese canal.
- [ ] **Email resumen diario:** un único email a la mañana con todos los resultados del día anterior; si no hubo, **no se envía**.
- [ ] **WhatsApp:** llega el template correcto según el desenlace (ganó/perdió/campeón/finalista), con los datos bien (jugador, ronda, torneo, rival, score).
- [ ] **Defaults:** usuario con email verificado → email resumen diario, WhatsApp off. Usuario sin email → WhatsApp inmediato, email off. Frozen al crear; al verificar email se **avisa** (no se auto-cambia).
- [ ] **No backfill:** marcar un favorito que ya jugó NO dispara avisos de resultados viejos.
- [ ] El sync corre cada hora de **8am–medianoche UY** y nada de noche; el resumen diario sale a la mañana.
- [ ] Página dedicada de notificaciones: elegir modo por canal y silenciar/activar cada favorito por canal.
- [ ] `pnpm typecheck` y `pnpm build` pasan.

---

## Decisiones cerradas (no re-discutir)

> Cerradas en `/grill-me` (2026-06-10). Lenguaje en `docs/context.md` § "Notificaciones de resultados".

| Tema | Decisión |
|---|---|
| **Disparador** | Dueño de un `FavoritePlayer` ← **resultado nuevo** de ese nombre en un cuadro externo. NO incluye los partidos propios del usuario (carrera privada) ni los **BYE**. "Seguir" = favorito (no es concepto nuevo). |
| **Canales** | **Email** (`off` / `cada resultado` / `resumen diario`) + **WhatsApp** (`off` / `cada resultado`). Independientes: un user puede tener email resumen **y** WhatsApp inmediato a la vez. |
| **Granularidad** | Por favorito **y** por canal: `FavoritePlayer.notifyEmail` + `notifyWhatsapp` (bool, default `true`). Silenciar ≠ quitar de favoritos (sigue resaltado en `/cuadros`). Separa amigos (notificables) de rivales (solo visuales). |
| **Defaults (frozen)** | Se fijan **al crear** el usuario y **no** se auto-cambian. Como todo user nuevo nace phone-first (sin email) → `whatsapp=IMMEDIATE`, `email=OFF`. Owner/seed (con email) y usuarios existentes con email verificado → `email=DIGEST`, `whatsapp=OFF`. |
| **Verificar email después** | NO cambia las preferencias. Al completar la verificación se **avisa** ("ya podés recibir por email, está el resumen diario") con link a la config; el cambio lo hace el usuario. |
| **Desenlaces (4, copy propio)** | `WON` (ganó y avanza) · `LOST` (perdió y queda afuera) · `CHAMPION` (ganó la final) · `FINALIST` (perdió la final). W.O. y retiro se **pliegan** en won/lost según el ganador. **BYE no notifica.** El tipo de desenlace **no** es configurable. |
| **Backfill** | **Solo a futuro** (new-only). La primera vez que se ve un cuadro = **baseline** (se registra el estado, no se notifica). Solo las **transiciones** `pending→played` posteriores disparan. |
| **Correcciones** | Un resultado ya avisado que cambia después **no** re-notifica (solo dispara la transición a jugado). |
| **Motor** | **Bandeja de salida** (`ResultNotification`) poblada en el sync por **diff** del cuadro viejo↔nuevo. Da: dedup (unique key), reintentos, y permite armar el resumen diario. Dispatch inmediato en el mismo run; resumen en un cron diario. |
| **Cadencia de sync** | Cambia de `0 */6 * * *` a **`0 0-3,11-23 * * *` (UTC)** = cada hora **8am–medianoche UY**, nada entre 1am–7am. Razón: la base Neon se autosuspende a los 5 min; sincronizar de noche la despierta y cuesta, sin partidos nuevos a esa hora. (Uruguay es UTC-3 fijo, sin DST.) |
| **Resumen diario** | Cron nuevo a la mañana (ej. **`0 11 * * *` UTC** = 8am UY): junta de la bandeja los eventos del día anterior pendientes de email-digest por usuario → 1 email → marca enviado. Sin eventos = sin email. |
| **Email educativo** | Los emails (resumen e inmediato) llevan una línea: "configurá tus notificaciones / también te las podemos mandar por WhatsApp" + link a la página. |
| **Elegibilidad / envío** | WhatsApp: todos los users tienen `phone` verificado (identidad primaria) → siempre alcanzable. **Optimización in-window**: ventana de 24h abierta (`lastInboundAt` < 24h) → `sendText` (texto libre, **gratis**); cerrada → `sendTemplate` (marketing, **pago**). Email: requiere `emailVerifiedAt`; sin eso, el canal email no entrega (queda `SKIPPED`). |
| **UI** | **Página dedicada** (`/[slug]/notificaciones`, solo dueño): arriba los **modos globales** (email/WhatsApp), abajo la **lista de favoritos** con toggles por canal. Links desde Ajustes y `/cuadros`. |
| **Fase** | **Una sola** (email + WhatsApp juntos). Bloqueante: los **4 templates UTILITY** aprobados por Meta antes de cerrar. |
| **Costo / categoría** | Meta **recategorizó** `won`/`lost` de UTILITY → **MARKETING** (2026-06-10; un resultado de un tercero = contenido de engagement, no una utilidad transaccional del receptor); `champion`/`finalist` seguirán igual. Implica: tarifa **marketing** (más cara) + **topes de frecuencia de marketing** de Meta por usuario (algunos avisos podrían no entregarse) + el user puede optar por no recibir marketing / marcar spam (baja la calidad del número). **Refuerza el default email-first** (WhatsApp solo secundario). Sin tope de gasto propio en el MVP. Apelar a utility es posible (botón "Solicitar revisión" en WhatsApp Manager, hasta ago-2026) pero de baja probabilidad — se aceptó marketing. |

---

## All Needed Context

### Documentation & References

```yaml
- file: src/services/favorite-service.ts
  why: FavoritePlayer por nameKey (normalizeName). toggleFavorite/getFavoriteKeys. Acá se suman los toggles por canal y el matching de nombres del sync.

- file: src/services/external-bracket-service.ts
  why: syncExternalBrackets() — el orquestador donde se engancha el motor. upsertBracket() PISA el data; hay que leer el bracket viejo ANTES de pisarlo para diffear. rawHash ya permite saltear cuadros sin cambios.

- file: src/lib/cuadros/types.ts
  why: NormalizedBracket / NormalizedMatch (status pending|played|bye, winner 1|2, score, p1/p2.name). De acá sale qué es un "resultado nuevo" y los datos del aviso (ronda = round.label, siguiente = rounds[index+1].label, final = último round).

- file: src/lib/cuadros/round-label.ts + src/lib/text.ts
  why: round-label para etiquetas de ronda; normalizeName (text.ts) para cruzar nombres del cuadro con FavoritePlayer.nameKey.

- file: src/app/api/cron/sync-cuadros/route.ts + src/app/api/cron/curation/route.ts + vercel.json
  why: patrón de cron (CRON_SECRET fail-closed). Cambiar el schedule del sync; sumar el cron del resumen diario.

- file: src/services/email-service.ts + src/components/emails/*.tsx + src/components/emails/email-theme.ts
  why: patrón de envío (Resend, shouldSendEmails, fromAddress) y de template React Email. Sumar sendResultNotificationEmail (inmediato) y sendDailyDigestEmail (resumen) + sus componentes.

- file: src/services/whatsapp-service.ts
  why: hoy solo sendText (free-form, ventana 24h). Sumar sendTemplate() (Kapso, NAMED params, fuera de ventana). El proxy Kapso y KAPSO_PHONE_NUMBER_ID ya están.

- file: .claude/skills/integrate-whatsapp/references/templates-reference.md
  why: reglas de envío de template (NAMED → parameter_name en body; sin header en AUTHENTICATION; etc.). Los templates ya creados: player_match_won (5 vars), player_match_lost (4 vars). Faltan champion/finalist.

- file: src/app/[slug]/ajustes/* + src/components/profile/email-banner.tsx + email-banner-actions.ts
  why: patrón de página de owner (gating por viewer==owner) y del flujo de verificación de email (acá se engancha el aviso post-verificación). La página /[slug]/notificaciones lo calca.

- file: src/components/cuadros/favorites-provider.tsx + bracket-match.tsx
  why: cómo se marcan/leen los favoritos en /cuadros. Sumar el link a la config y, si se quiere, el indicador de silenciado.

- file: AGENTS.md + node_modules/next/dist/docs/
  why: Next.js 16 (proxy.ts, RSC, server actions). Leer antes de codear rutas/crons.
```

### Known Gotchas

```typescript
// CRITICAL: upsertBracket() PISA ExternalBracket.data. Para detectar "resultados nuevos" hay que LEER
//           el bracket viejo (data) ANTES del upsert y diffear old↔new. Si rawHash no cambió → no hay nada nuevo, saltear.
// CRITICAL: NEW-ONLY. La detección es por TRANSICIÓN: old[round,slot].status != 'played' && new == 'played'.
//           BASELINE por FLAG por bracket (ExternalBracket.notificationsBaselineAt): la 1a vez que el MOTOR ve un
//           bracket (flag null) → registrar estado y NO notificar; recién con el flag seteado diffea y avisa.
//           Cubre brackets nuevos (old==null) Y los PREEXISTENTES en DB (old poblado) → sin storm post-deploy.
//           `old==null` por sí solo NO alcanza: los cuadros ya sincronizados tienen data y dispararían el primer diff.
// CRITICAL: Identidad estable del partido para dedup = (userId, bracketId, roundIndex, matchSlot, nameKey).
//           Incluir nameKey: un partido entre dos favoritos del MISMO user genera DOS avisos (uno ganó, otro perdió).
// CRITICAL: Favoritos por NOMBRE (opaco). Limitaciones aceptadas: homónimos = falsos positivos; dobles
//           (slot "A. Pérez / B. López") NO matchea un favorito de un solo nombre. No intentar resolver identidad acá.
// CRITICAL: CHAMPION/FINALIST = ganador/perdedor del partido de la ÚLTIMA ronda (mayor index, label "Final").
//           WON/LOST = resto. El "siguiente" del WON = rounds[index+1].label.
// CRITICAL: WhatsApp cost. Los templates de notificación son MARKETING → se cobran SIEMPRE, incluso dentro de la
//           ventana 24h (un utility-in-window sería gratis, pero estos ya NO son utility). OPTIMIZACIÓN: el texto
//           LIBRE (sendText) dentro de la ventana 24h es GRATIS. Dispatch: si lastInboundAt < 24h → sendText con el
//           mismo copy (gratis); si la ventana está cerrada → sendTemplate (marketing, pago). Email solo si emailVerifiedAt.
// CRITICAL: Score = string CRUDO de la fuente (perspectiva del cuadro p1/p2, no del favorito). En el MVP se muestra
//           tal cual; no se normaliza a la perspectiva del favorito.
// PATTERN: Solo services/* toca Prisma. El diff/matching puede vivir en src/lib/cuadros/ (puro) y el service orquesta.
//          Sin try/catch ni clases en services. Actions → ActionResult<T>. Strings en español con tildes.
// GOTCHA: Defaults frozen: enum fields en User con @default(IMMEDIATE)/@default(OFF) → como los users nacen
//          phone-first, el default estático YA es el "smart default" para ellos. Migración: backfillear los
//          existentes CON email verificado a email=DIGEST, whatsapp=OFF. NO auto-cambiar al verificar email después.
```

---

## Implementation Blueprint

### Data Models

Schema **completo de la feature** (migración única). Sobre `prisma/schema.prisma`:

```prisma
enum EmailNotifyMode    { OFF  IMMEDIATE  DIGEST }
enum WhatsappNotifyMode { OFF  IMMEDIATE }
enum NotifyOutcome      { WON  LOST  CHAMPION  FINALIST }
enum NotifyChannelStatus { PENDING  SENT  SKIPPED  FAILED }

model User {
  // ...campos existentes...
  // Preferencias de notificación. Defaults estáticos = el "smart default" del user phone-first
  // (sin email al crearse → WhatsApp inmediato, email off). Frozen: no se auto-cambian.
  notifyEmailMode    EmailNotifyMode    @default(OFF)
  notifyWhatsappMode WhatsappNotifyMode @default(IMMEDIATE)
  resultNotifications ResultNotification[]
}

model FavoritePlayer {
  // ...campos existentes (userId, nameKey, name, ...)...
  notifyEmail    Boolean @default(true)   // silenciar ≠ quitar de favoritos
  notifyWhatsapp Boolean @default(true)
}

// Bandeja de salida: una fila por (favorito, partido) detectado. Self-contained (datos denormalizados)
// para sobrevivir cambios del cuadro y armar el resumen sin re-leer el bracket.
model ResultNotification {
  id            String        @id @default(cuid())
  userId        String
  nameKey       String        // favorito que matcheó (normalizado)
  playerName    String        // display name del slot al detectar

  // identidad estable del partido (dedup). bracketId/tournamentId como String (sin FK):
  // las notificaciones son históricas y sobreviven a deleteMissingBrackets.
  tournamentId  String
  bracketId     String
  roundIndex    Int
  matchSlot     Int
  outcome       NotifyOutcome

  // denormalizado para render (email/WhatsApp), inmune a cambios posteriores del cuadro:
  tournamentName String
  categoryName   String
  roundLabel     String
  nextRoundLabel String?       // solo WON
  opponentName   String?
  score          String?
  tournamentSlug String        // para linkear al cuadro
  categorySlug   String

  detectedAt     DateTime @default(now())
  emailStatus    NotifyChannelStatus @default(PENDING)
  emailSentAt    DateTime?
  whatsappStatus NotifyChannelStatus @default(PENDING)
  whatsappSentAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, bracketId, roundIndex, matchSlot, nameKey]) // dedup / idempotencia
  @@index([userId, detectedAt])
  @@index([emailStatus])
  @@index([whatsappStatus])
}
```

**Campo extra en `ExternalBracket`** (modelo de la feature cuadros, misma migración): `notificationsBaselineAt DateTime?` — baseline del motor de notificaciones **por bracket** (ver Motor de detección). Sin esto, el primer diff post-deploy de un bracket **preexistente** dispararía avisos de resultados viejos.

**Migración custom** (además del schema): backfill de `User` existentes → los que tienen `emailVerifiedAt != null` pasan a `notifyEmailMode = DIGEST`, `notifyWhatsappMode = OFF` (el seed del owner explícito). `FavoritePlayer` existentes quedan con los defaults (`notify* = true`).

### Resolución de modo efectivo (sin auto-cambio)

```typescript
// Los defaults ya están materializados en la columna (frozen). El "efectivo" solo agrega
// el gate de elegibilidad de email (no se puede mandar email sin email verificado).
effectiveEmailMode(user)    = user.emailVerifiedAt ? user.notifyEmailMode : 'OFF'
effectiveWhatsappMode(user) = user.notifyWhatsappMode   // phone siempre verificado
```

### Motor de detección (en el sync) — pseudocódigo

```
# external-bracket-service.syncExternalBrackets(), por cada categoría, ANTES del upsertBracket:
old = existingBracket?.data            # NormalizedBracket o null (primera vez)
new = res.normalized
if existingBracket && existingBracket.rawHash == sha256(res.raw): skip   # nada cambió
if existingBracket?.notificationsBaselineAt == null:                      # BASELINE (nuevo o preexistente):
    upsert(new); setNotificationsBaselineAt(now); continue                #   registrar estado, NO notificar

newResults = []
for round in new.rounds:
  isFinal = (round.index == last index)
  for m in round.matches where m.status == 'played' && m.winner:
    o = old round[round.index]?.matches[m.slot]
    if o && o.status == 'played': continue           # ya estaba jugado (no es transición)
    winnerSlot = m.winner == 1 ? m.p1 : m.p2
    loserSlot  = m.winner == 1 ? m.p2 : m.p1
    newResults.push({ round, m, winnerSlot, loserSlot, isFinal })
upsert(new)                                            # recién ahora se pisa

# cruce con favoritos (todos los users)
names = unique(normalizeName de winner/loser de newResults, ignorando byes)
favs = favoriteService.findByNameKeys(names)           # [{ userId, nameKey, name, notifyEmail, notifyWhatsapp }]
for r in newResults:
  for slot, role in [(winnerSlot, 'winner'), (loserSlot, 'loser')]:
    if slot.bye: continue
    for f in favs where f.nameKey == normalizeName(slot.name):
      outcome = role=='winner' ? (r.isFinal ? CHAMPION : WON) : (r.isFinal ? FINALIST : LOST)
      # solo crear si algún canal podría entregar (evita filas muertas)
      if (f.notifyEmail && emailModeOf(user)!=OFF) || (f.notifyWhatsapp && whatsappModeOf(user)!=OFF):
        createResultNotification(unique key → on conflict do nothing, denormalizando torneo/ronda/rival/score)

# dispatch inmediato (mismo run, sobre las filas PENDING recién creadas)
for n in pendingNotifications:
  user, fav = ...
  # email inmediato
  if effectiveEmailMode(user)==IMMEDIATE && fav.notifyEmail: send + emailStatus=SENT
  elif effectiveEmailMode(user)==DIGEST && fav.notifyEmail: leave PENDING (lo toma el resumen)
  else: emailStatus = SKIPPED
  # whatsapp (solo inmediato). Ventana abierta = texto libre GRATIS; cerrada = template marketing (pago).
  if effectiveWhatsappMode(user)==IMMEDIATE && fav.notifyWhatsapp:
    windowOpen(user.phone) ? sendText(copy) : sendTemplate(outcome, vars);  whatsappStatus = SENT
  else: whatsappStatus = SKIPPED
  # fallo de envío → status FAILED (reintenta el próximo run sobre PENDING/FAILED)
```

```
# cron resumen diario (api/cron/notificaciones-digest, 8am UY)
for user with effectiveEmailMode(user)==DIGEST:
  rows = ResultNotification where userId, emailStatus==PENDING (intentos<3), y el favorito sigue notifyEmail,
         detectedAt < hoy 00:00 UY   # TODO lo pendiente hasta el corte (no solo "ayer"): recupera un digest que
                                     # falló un día. Boundary en timezone UY aunque el cron corra en UTC.
  if rows.length: sendDailyDigestEmail(user, rows); set emailStatus=SENT, emailSentAt=now
  # sin filas → no se manda nada
```

### WhatsApp templates (4, UTILITY, es)

Ya creados (PENDING al 2026-06-10): `player_match_won` (5 vars: jugador, ronda, torneo, siguiente, resultado), `player_match_lost` (4 vars: jugador, ronda, torneo, resultado). **A crear** siguiendo las mismas reglas (no var al inicio/fin; ratio variables/palabras; footer ≤60): `player_champion` y `player_finalist`. `whatsapp-service.sendTemplate({ to, name, languageCode:'es', namedParams })` (NAMED → `parameter_name` en el componente body; sin ventana 24h).

### Task List

```yaml
# Detalle fino → /grill-me + plan mode. Una sola fase; bloqueante = 4 templates aprobados.

Task 1: Schema + migración
  - prisma/schema.prisma: enums + campos en User + campos en FavoritePlayer + model ResultNotification.
  - Migración custom: backfill de Users con emailVerifiedAt → email=DIGEST, whatsapp=OFF.
  - pnpm db:migrate --name notificaciones.

Task 2: whatsapp-service.sendTemplate + templates faltantes
  - sendTemplate() (Kapso, NAMED, fuera de ventana) en whatsapp-service.
  - Crear player_champion + player_finalist (UTILITY/es) y esperar APPROVED (los 4).

Task 3: Motor de detección en el sync
  - external-bracket-service: leer bracket viejo antes de upsert; diff old↔new (transición→played);
    baseline si old==null; cruce con favorites (findByNameKeys); crear ResultNotification idempotente.
  - Lógica de diff pura en src/lib/cuadros/ (testeable): detectNewResults(old, new) → [{round, match, winner/loser, isFinal}].
  - favorite-service: findByNameKeys(names) con los toggles.

Task 4: Canales + dispatch
  - email-service: sendResultNotificationEmail (inmediato) + sendDailyDigestEmail (resumen) + componentes React Email
    (con la línea educativa + link a la config).
  - notification-service (o en external-bracket-service): dispatchPending() — inmediatos en el sync; estados por canal.
  - Reintentos: hasta 3 por canal en runs sucesivos (contador por canal); al agotar → terminal + log, sin alerta.
    windowOpen de WhatsApp cacheado por phone dentro del run (no consultar Kapso N veces por el mismo user).
  - Cron resumen diario: src/app/api/cron/notificaciones-digest/route.ts (CRON_SECRET) + vercel.json.

Task 5: Cadencia de sync
  - vercel.json: sync-cuadros "0 0-3,11-23 * * *"; digest "0 11 * * *".

Task 6: UI — página de notificaciones
  - src/app/[slug]/notificaciones/page.tsx (owner-only): modos globales (Select email/whatsapp) +
    lista de favoritos con Switch notifyEmail/notifyWhatsapp por fila.
  - actions.ts: setNotifyMode, setFavoriteChannel (ActionResult<T>, revalidatePath).
  - Links desde Ajustes y /cuadros. Suspense + Skeleton.

Task 7: Aviso post-verificación de email
  - En el flujo del email-banner: al setear emailVerifiedAt, DIALOG de éxito "ya podés recibir por email + resumen
    diario" con link a /[slug]/notificaciones. NO cambia preferencias.

Task 8: Nudge de notificaciones (incluido en la fase)
  - Cartel in-app con X: descartable permanente (el descarte se persiste en User → vale entre dispositivos).
  - Aparece SOLO si el user tiene ≥1 favorito y (ningún canal efectivo activo  O  email sin verificar).
  - Distinto del banner de email (sticky, sin X, sobre auth); este es sobre canales de aviso.
```

---

## Validation Loop

### Level 1 — Tipos / Prisma
```bash
pnpm run typecheck
pnpm prisma validate
pnpm db:migrate --name notificaciones
```

### Level 2 — Diff (unit)
```bash
# Test de detectNewResults(old, new) con fixtures de NormalizedBracket:
# - transición pending→played dispara; played→played no; old==null = baseline (vacío).
# - final → CHAMPION/FINALIST; resto → WON/LOST. dos favoritos en un match → dos eventos.
```

### Level 3 — Build
```bash
pnpm run build
```

### Level 4 — Manual E2E
- Marcar un favorito que va a jugar; disparar sync (botón admin) tras un resultado nuevo → llega el aviso una sola vez por el canal correcto.
- Silenciar el favorito por WhatsApp → sigue resaltado en /cuadros, ya no llega WhatsApp; email según su modo.
- Modo resumen: varios resultados en el día → un solo email a la mañana siguiente; día sin resultados → sin email.
- Marcar un favorito con partidos ya jugados → NO llegan avisos viejos (new-only).
- Verificar un email en un user phone-only → aviso "ya podés por email"; las preferencias NO cambian solas.
- Re-disparar el sync sin cambios → no se duplica ningún aviso (dedup).

---

## Final Checklist

### Arquitectura
- [ ] Solo `services/` toca Prisma; el diff (`detectNewResults`) es puro y testeable.
- [ ] Dedup por `(userId, bracketId, roundIndex, matchSlot, nameKey)`; baseline cuando `old==null`.
- [ ] WhatsApp in-window: `sendText` (gratis) si la ventana de 24h está abierta, `sendTemplate` (marketing) si cerrada. Email solo con `emailVerifiedAt`.
- [ ] Crons con `CRON_SECRET` fail-closed; schedules en UTC con el mapeo a UY documentado.

### Comportamiento
- [ ] New-only real (transición), sin storm en el primer sync ni al aparecer un torneo nuevo.
- [ ] 4 desenlaces con el template/copy correcto; BYE no notifica; W.O./retiro plegados.
- [ ] Silenciar por canal respeta /cuadros (sigue resaltado) y corta solo ese canal.
- [ ] Defaults frozen correctos; al verificar email se avisa sin auto-cambiar.
- [ ] Resumen diario agrupa el día anterior; sin eventos no manda.

### Calidad
- [ ] Strings en español con tildes; controles con `src/components/ui/*`; capturas en `<form>`.
- [ ] RSC por defecto; "use client" solo donde hay interacción (toggles). Suspense + Skeleton.

---

## Anti-Patterns

- ❌ NO notificar en el **baseline** (primera vez que se ve un cuadro) ni resultados ya jugados al marcar favorito → storm. Solo transiciones.
- ❌ NO mandar `sendTemplate` (marketing, pago) con la ventana de 24h **abierta** → ahí va `sendText` (gratis). Ni intentar `sendText` con la ventana **cerrada** → Meta lo rechaza, ahí va el template.
- ❌ NO mandar email sin `emailVerifiedAt`.
- ❌ NO auto-cambiar las preferencias al verificar email (solo avisar).
- ❌ NO re-notificar correcciones de un resultado ya avisado.
- ❌ NO intentar resolver identidad de nombres (homónimos/dobles) en el MVP — limitación aceptada del favorito-por-nombre.
- ❌ NO sincronizar de noche (despierta Neon, cuesta, sin partidos nuevos).
- ❌ NO meter Prisma en el diff; el matching de favoritos lo hace el service.
- ❌ NO crear los templates de notificación como **UTILITY** — su categoría real es **MARKETING** (avisan sobre un **tercero**, no sobre el order/account/transacción del **receptor**, que es el criterio de utility). Meta los recategoriza solo, y **insistir gatilla un *warning* de misuse → restringe la creación de templates utility 7 días**. Crearlos como MARKETING de entrada. (Confirmado en la doc de categorización de Meta, 2026-06-10.)

---

## Preguntas resueltas (grill-me 2026-06-10)

- ✅ **Disparador:** favorito + cuadro externo; al dueño del favorito.
- ✅ **Canales/modos:** email off/inmediato/resumen, whatsapp off/inmediato; independientes.
- ✅ **Granularidad:** por favorito y por canal (silenciar ≠ quitar de favoritos).
- ✅ **Defaults:** email-si-verificado / whatsapp-si-no; frozen + aviso al verificar email.
- ✅ **Desenlaces:** 4 con copy propio; BYE no; W.O./retiro plegados; no configurable por tipo.
- ✅ **Backfill:** new-only; baseline al primer avistaje.
- ✅ **Motor:** bandeja de salida + diff en el sync; dispatch inmediato + cron de resumen.
- ✅ **Cadencia:** sync horario 8am–medianoche UY (no de noche por Neon).
- ✅ **UI:** página dedicada `/[slug]/notificaciones`.
- ✅ **Fase:** una sola, atada a los 4 templates aprobados.

## Decisiones de implementación (grill-me 2026-06-10, 2a pasada)

- ✅ **Baseline post-deploy:** flag `notificationsBaselineAt` por bracket (no solo `old==null`) → sin storm con brackets preexistentes.
- ✅ **Envío WhatsApp:** optimización in-window (`sendText` gratis si la ventana está abierta; `sendTemplate` si cerrada).
- ✅ **Reintentos:** hasta 3 por canal, luego terminal + log (sin alerta).
- ✅ **Ruta:** `/[slug]/notificaciones`.
- ✅ **Nudge:** incluido, con X descartable (persistido en User); aparece si hay ≥1 favorito y (sin canal activo o email sin verificar).
- ✅ **Aviso post-verificación:** dialog de éxito (no auto-cambia preferencias).
- ✅ **Digest robusto:** junta todo lo PENDING hasta el corte (hoy 00:00 UY), no solo el día anterior → recupera un digest fallido.

## Preguntas abiertas (no bloqueantes)

- **Tope de gasto WhatsApp:** sin límite en el MVP (volumen bajo); revisar si crece.
- **Score en la perspectiva del favorito:** crudo en el MVP; normalizarlo (flip p1/p2) sería un post-MVP.
- **Copy exacto de `player_champion` / `player_finalist`:** se redacta al crearlos (mismas reglas de Meta).

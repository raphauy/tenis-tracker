# PRP: Cuadros externos

**Feature doc:** factibilidad de las fuentes en [`docs/research/cuadros-academia-mg-google-sheets.md`](../research/cuadros-academia-mg-google-sheets.md) (planilla manual, parseo posicional, dos formatos) y [`docs/research/cuadros-aut-grados-mur-academy.md`](../research/cuadros-aut-grados-mur-academy.md) (API PostgREST limpia, PII expuesta).
**Glosario:** [`docs/context.md`](../context.md) § "Cuadros externos" (Cuadro externo, Fuente, Adapter, Etapa, `identityKey`, `live`/`archived`).
**ADR:** [0003 — Identidad del cuadro externo por contenido + archive-on-flip](../adr/0003-identidad-cuadro-externo-por-contenido.md).
**Estado:** Listo para derivar fases / `grill-me` por fase.

> Feature post-MVP, independiente de la carrera privada. Riesgo de negocio bajo: si una fuente cae, se sigue sirviendo el último snapshot bueno.

---

## Goal

Mostrar **cuadros públicos** (brackets de eliminación, sin dueño) de torneos de terceros en `/cuadros`, con UI **mobile-first + desktop** ("dos versiones"), alimentados por un **modelo de fuentes extensible**. Se sirve desde nuestra DB (no en vivo), lo que da resiliencia y convierte a Tenis Tracker en el **archivo histórico** de esos cuadros (resuelve el dolor real: la planilla de Academia MG se sobreescribe y el torneo viejo desaparece).

Dos fuentes en el MVP: **Academia MG** (CSV de Google Sheets, manual/ruidosa) y **AUT Grados / MUR** (API Supabase/PostgREST, limpia). Las dos comparten el **cuadro normalizado** y el **componente de UI**; difieren solo en la **capa de ingesta (Adapter)**.

## Why

- El dueño y otros jugadores quieren ver/seguir los cuadros en una UI linda; las fuentes originales son una planilla rudimentaria y una web de terceros.
- La planilla de Academia MG **se reusa entre etapas** → sin un archivo propio, los torneos pasados se pierden (caso vivido). Persistir + keyear por contenido lo arregla.
- Deja una **abstracción de fuentes** reutilizable: sumar un torneo del mismo tipo = config; sumar un tipo nuevo = un Adapter.

## What

Tres bloques, en fases:

1. **Fundaciones + Academia MG (F1):** schema completo de la feature, registry de fuentes en código, Adapter `google-sheets-academia` (parser posicional tolerante a ruido + `identityKey` por contenido + archive-on-flip), sync (cron ~6h + botón manual + alerta por fallo), y la UI pública `/cuadros` (bracket mobile por rondas / desktop árbol completo).
2. **AUT Grados / MUR (F2):** Adapter `mur-supabase` (PostgREST, PII-safe, `identityKey` por uuid) reusando modelo y UI. Backfill de etapas pasadas.
3. **Round-robin (F3):** parser de grupos ("SERIE") de Academia + UI de tablas/posiciones, bajo las mismas rutas.

### Success Criteria

- [ ] `/cuadros` (público, sin auth) lista los torneos externos (`live` + `archived`) ordenados por fecha; entrar a uno lista sus categorías; entrar a una categoría renderiza el bracket.
- [ ] El bracket se ve bien en **mobile (por rondas)** y en **desktop (árbol completo con conectores)**; muestra seed, ganador (por posición), score crudo, y badges para `Wo.`/`Ret.`; los partidos no jugados salen como "pendiente".
- [ ] El sync baja, normaliza y persiste el cuadro (JSON) + `rawHash` + snapshot crudo; la UI muestra "actualizado hace X".
- [ ] Cuando la planilla de Academia flipea a una etapa nueva, el torneo anterior queda **`archived`** (visible, "finalizado") y se crea uno nuevo — no se pisa.
- [ ] Un fallo de sync **no rompe** la UI (sirve el último bueno), alerta por email al superadmin y queda registrado en `/admin/cuadros`.
- [ ] La PII de MUR (email/teléfono/fecha de nacimiento) **nunca** se almacena ni se muestra.
- [ ] Sumar un torneo del mismo tipo = una entrada en el registry; no hace falta tocar el schema ni la UI.
- [ ] `pnpm typecheck` y `pnpm build` pasan.

---

## Decisiones cerradas (no re-discutir)

> Cerradas en `/grill-me` (2026-06-08). Lenguaje en `docs/context.md` § "Cuadros externos"; keying en ADR 0003.

| Tema | Decisión |
|---|---|
| **Modelo** | Modelos **nuevos y separados**, desacoplados de `Tournament`/`Entry`/`Match` (esos son la carrera privada, atada a `userId`). El cuadro externo es público y sin dueño. |
| **Formatos (MVP)** | **Solo bracket** (single-elimination). Cubre AUT 100% y 5/9 categorías de Academia (incl. Dobles Cab gratis — un slot es un string opaco). Round-robin = F3. |
| **Registro de fuentes** | **Config en código** (registry tipado en `src/lib/cuadros/sources.ts`). La entrada = la **Fuente/contenedor** (`{ type, config }`), no un torneo. El dato sincronizado va a la DB. Sumar torneo del mismo tipo = nueva entrada; sin admin CRUD. |
| **Adapter / extensibilidad** | El **tipo** (Adapter) es código; la **instancia** es config. `sourceType` se guarda como **String** (no enum Prisma) para sumar adapters sin migración. |
| **Descubrimiento** | Etapas y categorías **auto-discover** por el Adapter (NO hardcodear gids — cambian entre etapas). El formato (bracket vs round-robin) se clasifica en el parseo; round-robin se omite en MVP. |
| **Persistencia** | `ExternalTournament` (parent, una fila por `identityKey`) + `ExternalBracket` (una fila por categoría) con el **cuadro normalizado en JSON** + `lastSyncedAt` + `rawHash` + `rawSnapshot`. Se renderiza entero; sin queries por jugador en el MVP. |
| **Identidad / flip** | **`identityKey` por contenido** en Academia (`academia-mg:<etapa>`), por **locator** en MUR (`mur:<uuid>`). Upsert por `identityKey`. Al flipear → torneo viejo `archived` (congelado, "finalizado", visible siempre). Ver ADR 0003. |
| **Sync** | **Cron dedicado** (`/api/cron/sync-cuadros`, ~cada 6h) + **botón "sincronizar ahora"** en `/admin/cuadros`. Sujeto al límite de cron del plan Vercel. |
| **Fallo de sync** | Servir **último bueno** (nunca romper la UI) + **alerta por email** al superadmin (reusa `email-service`) + estado/errores en `/admin/cuadros`. `lastSyncedAt` visible en la UI pública. |
| **Ruta / acceso** | **`/cuadros` público sin auth**: `/cuadros` → `/cuadros/[torneo]` → `/cuadros/[torneo]/[categoria]`. `cuadros` se agrega a `RESERVED_SLUGS`. |
| **UI bracket** | **Dos layouts** ("dos versiones"): mobile = navegación por rondas (legible); desktop = árbol completo con conectores. Desktop tree estático (RSC); el switcher de rondas de mobile es un client component chico. |
| **Ronda del cuadro** | Representación **propia** (índice ordenado + etiqueta + tamaño de ronda), desacoplada del enum `Round` privado, para tolerar tamaños variables (64/48/32/…), byes y play-ins. |
| **Score** | String crudo de la fuente, se muestra tal cual; se reconocen tokens `Wo.`/`Ret.`/super-TB para badges. El ganador se matchea **por posición**, no por igualdad de string (hay typos en Academia). |
| **PII (MUR)** | `select` solo lo necesario (`player_name`, `seed_position`, resultados). **Nunca** almacenar ni mostrar email/teléfono/fecha de nacimiento (RLS mal configurado de MUR, no nuestro). |
| **Fasing** | **F1 = Academia MG** (valida la abstracción contra la fuente difícil; migra el schema completo de la feature) · **F2 = AUT/MUR** (adapter fino) · **F3 = round-robin**. |
| **Historial** | MUR **backfilleable** (UUIDs estables); Academia **acumula desde el launch** (etapas pasadas ya sobreescritas, irrecuperables). |
| **Cross-link a `/[slug]`** | **Fuera de alcance** (post-feature). Nombres del cuadro NO se cruzan con `Player`/usuarios en el MVP. |

---

## All Needed Context

### Documentation & References

```yaml
- file: docs/research/cuadros-academia-mg-google-sheets.md
  why: Fuente 1. § 2 acceso CSV export; § 2.2 descubrimiento de gids; § 3.1 filas de cabecera (de donde sale la identityKey por contenido); § 4.1 geometría del bracket + algoritmo de parseo posicional; § 5 irregularidades (typos, play-ins, tokens Wo./Ret., draws variables).

- file: docs/research/cuadros-aut-grados-mur-academy.md
  why: Fuente 2. § 2 API PostgREST + anon key; § 3 tablas/relaciones (matches.playerN_id → registrations.id, NO players.id); § 4 receta de armado del bracket; § 5 PII expuesta (filtrar); Apéndice A endpoints.

- file: docs/adr/0003-identidad-cuadro-externo-por-contenido.md
  why: Por qué keyear por contenido y archivar al flipear, no por locator.

- file: src/app/api/cron/curation/route.ts + vercel.json
  why: Patrón de API route de cron (CRON_SECRET fail-closed) y registro del schedule. El cron de cuadros sigue la misma forma.

- file: src/services/email-service.ts + src/components/emails/curation-email.tsx
  why: Patrón de servicio de envío y template de email. La alerta de fallo de sync lo replica.

- file: src/lib/slug.ts
  why: RESERVED_SLUGS — agregar `cuadros` antes de crear la ruta (igual que cualquier top-level, ver ADR 0001).

- file: src/components/admin/admin-nav.tsx + src/app/admin/whatsapp/*
  why: Patrón de sub-nav del admin y de panel (estado + acciones). El panel /admin/cuadros lo calca.

- file: AGENTS.md + node_modules/next/dist/docs/
  why: Next.js 16 tiene breaking changes; leer antes de codear API routes / rutas dinámicas / RSC.
```

### Known Gotchas

```typescript
// CRITICAL: Academia reusa el MISMO spreadsheet entre etapas. La identidad es por CONTENIDO
//           (etapa parseada del header), no por spreadsheetId+gid. Al flipear → archived, no pisar. (ADR 0003)
// CRITICAL: En Academia el ganador NO se matchea por string (hay typos: F. Echevarria vs F. Echavarria).
//           Se matchea por POSICIÓN (geometría del CSV). Guardar igual el string crudo del ganador/score.
// CRITICAL: Los headers de columna de la planilla están corridos 1 columna vs la ronda real.
//           Re-etiquetar las rondas por GEOMETRÍA (cantidad de entrantes en col1), no por el texto del header.
// CRITICAL: MUR: matches.playerN_id → registrations.id (por torneo), NO a players.id. El embedding por FK
//           de PostgREST NO funciona (no hay FK en el schema cache) → segunda request a registrations + join en cliente.
// CRITICAL: MUR expone PII (email/phone/birth_date) vía la anon key. select SOLO lo necesario; nunca persistir/mostrar PII.
// CRITICAL: La anon key de MUR puede rotar / el RLS endurecerse / el schema cambiar sin aviso. No fallar silencioso:
//           servir último bueno + alertar. Key en env (MUR_SUPABASE_ANON_KEY), no en el registry ni en DB.
// CRITICAL: Solo src/services/* importa @/lib/prisma. Adapters/parsers viven en src/lib/cuadros/ (puros, sin Prisma).
// CRITICAL: Next.js 16 — src/proxy.ts (no middleware.ts). /cuadros y /cuadros/* deben ser públicos sin sesión
//           (mismo trato que el perfil público en proxy.ts).
// PATTERN: Sin try/catch ni clases en services. Actions devuelven ActionResult<T>. RSC por defecto;
//          "use client" solo el switcher de rondas mobile. Suspense + Skeleton (no loading.tsx).
// GOTCHA: límite de cron del plan Vercel (Hobby ≈ 1×/día y pocos jobs). Si aplica, el botón manual es el escape.
```

---

## Implementation Blueprint

### Data Models

Schema **completo de la feature** (se migra entero en F1, ver reglas de PRPs). Sobre `prisma/schema.prisma`:

```prisma
enum ExternalTournamentStatus {
  LIVE       // presente en la fuente, se sincroniza
  ARCHIVED   // la fuente flipeó a otra etapa → congelado, "finalizado"
}

enum BracketFormat {
  BRACKET      // single-elimination (MVP)
  ROUND_ROBIN  // grupos/SERIE (F3; la columna existe desde F1 para no migrar después)
}

// Un torneo/etapa externo. Una fila por identityKey (NO por locator de la fuente). Ver ADR 0003.
model ExternalTournament {
  id           String                   @id @default(cuid())
  sourceType   String                   // 'google-sheets-academia' | 'mur-supabase' (String, no enum: adapters sin migración)
  identityKey  String                   @unique // 'academia-mg:<etapa>' | 'mur:<uuid>'
  name         String                   // nombre a mostrar (de la fuente)
  startDate    DateTime?
  status       ExternalTournamentStatus @default(LIVE)
  lastSyncedAt DateTime?
  lastSyncError String?                 // último error de sync (null si el último fue OK)
  createdAt    DateTime                 @default(now())
  updatedAt    DateTime                 @updatedAt

  brackets ExternalBracket[]

  @@index([sourceType])
  @@index([status])
}

// El cuadro de una categoría. El draw normalizado va en `data` (JSON). Se lee/renderiza entero.
model ExternalBracket {
  id           String        @id @default(cuid())
  tournamentId String
  categoryName String        // 'SINGLES CABALLEROS - D', 'Sexta', ...
  slug         String        // slug de la categoría dentro del torneo (para la URL)
  format       BracketFormat @default(BRACKET)
  data         Json          // NormalizedBracket (ver tipo abajo)
  rawHash      String        // hash del crudo, para detectar cambios entre syncs
  rawSnapshot  String        // crudo (CSV / JSON) del último sync, para diagnóstico
  displayOrder Int           @default(0)
  lastSyncedAt DateTime      @default(now())
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  tournament ExternalTournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, slug])
  @@index([tournamentId])
}
```

Env: `MUR_SUPABASE_ANON_KEY` (F2), `GOOGLE_SHEETS_API_KEY` (opcional, F1 — enumerar hojas robusto; el CSV export no la necesita), `CRON_SECRET` (ya existe).

### Cuadro normalizado (contrato común de los Adapters)

`src/lib/cuadros/types.ts` — la forma que ambos Adapters producen y que se guarda en `ExternalBracket.data`:

```typescript
export type BracketSlot = {
  name: string          // display name; en dobles, "A. Pérez / B. López" (opaco)
  seed?: number
  sourceId?: string     // id estable en la fuente (uuid MUR); ausente en Academia
}

export type NormalizedMatch = {
  slot: number          // posición dentro de la ronda (alimenta los conectores)
  p1?: BracketSlot      // ausente = bye / TBD
  p2?: BracketSlot
  winner?: 1 | 2        // por POSICIÓN, no por string
  score?: string        // string crudo de la fuente; null si no se jugó
  outcome?: 'normal' | 'walkover' | 'retiro'
  status: 'pending' | 'played'
}

export type NormalizedRound = {
  index: number         // 0 = primera ronda
  label: string         // etiqueta a mostrar, re-etiquetada por geometría
  matches: NormalizedMatch[]
}

export type NormalizedBracket = {
  format: 'bracket'
  drawSize: number      // entrantes de la primera ronda (puede no ser potencia de 2)
  rounds: NormalizedRound[]
}
// F3: NormalizedGroupStage { format: 'round_robin'; groups: [...] } — mismo `data` JSON.
```

### Source registry + Adapter interface

```typescript
// src/lib/cuadros/sources.ts  (registro en código; el dato va a la DB)
export type SourceInstance =
  | { type: 'google-sheets-academia'; config: { spreadsheetId: string } }
  | { type: 'mur-supabase'; config: { baseUrl: string; nameFilter: string } } // anon key en env

export const SOURCES: SourceInstance[] = [
  { type: 'google-sheets-academia', config: { spreadsheetId: '1JpCOXQf9IUobOre6LgqyWjluD6BEdNJ0W9I02lpiWEo' } },
  // F2: { type: 'mur-supabase', config: { baseUrl: 'https://tsxzhdnyykknmivdpyzv.supabase.co/rest/v1', nameFilter: 'grados' } },
]

// src/lib/cuadros/adapters/<type>.ts  (puro, sin Prisma)
export interface SourceAdapter {
  type: string
  discoverTournaments(config): Promise<DiscoveredTournament[]>           // etapas vivas de la fuente
  discoverCategories(config, t: DiscoveredTournament): Promise<DiscoveredCategory[]>
  fetchBracket(config, c: DiscoveredCategory): Promise<{ normalized: NormalizedBracket; raw: string } | null> // null = no soportado (round-robin en MVP)
  identityKey(t: DiscoveredTournament): string                          // por contenido | por locator
}
```

### Task List

```yaml
# Detalle fino de cada fase se cierra con /grill-me + plan mode. Esto es el blueprint global.

# ===== Fase 1 — Academia MG + fundaciones (migra el schema completo de la feature) =====
Task F1.1: Schema + migración
  - MODIFY prisma/schema.prisma: enums ExternalTournamentStatus, BracketFormat;
    models ExternalTournament, ExternalBracket.
  - RUN pnpm db:migrate --name cuadros_externos.

Task F1.2: Tipos + contrato
  - src/lib/cuadros/types.ts: NormalizedBracket + SourceAdapter interface.
  - src/lib/cuadros/sources.ts: registry con la fuente Academia.

Task F1.3: Adapter google-sheets-academia (puro)
  - src/lib/cuadros/adapters/google-sheets-academia.ts:
    - fetch CSV export por gid; discoverCategories vía Sheets API key (o htmlview fallback).
    - parser posicional bracket (research § 4.1): col1 entrantes, ganador por punto medio,
      score en la celda de abajo, match por POSICIÓN, re-etiquetar rondas por geometría.
    - tolerante a ruido (research § 5): typos, play-ins, tokens Wo./Ret., celdas basura, draws variables.
    - identityKey por contenido (filas 0/2 del header). fetchBracket devuelve null para round-robin.
  - Tests del parser con fixtures CSV reales (al menos cat D bracket + una SERIE → null).

Task F1.4: Service + orquestador de sync
  - src/services/external-bracket-service.ts (única capa Prisma):
    upsertTournament(by identityKey), upsertBracket, archiveMissing (flip → ARCHIVED),
    recordSyncError, listTournaments, getTournamentBySlug, getBracket.
  - syncExternalBrackets(): por cada SOURCE → adapter.discover* → fetchBracket → hash → persist;
    si una identityKey deja de aparecer en la fuente → ARCHIVED; captura errores por fuente
    (no aborta el resto) y los registra.

Task F1.5: Cron + acción manual
  - src/app/api/cron/sync-cuadros/route.ts (patrón CRON_SECRET fail-closed) → syncExternalBrackets().
  - vercel.json: cron "0 */6 * * *" (ajustar al plan).
  - src/app/admin/cuadros/actions.ts: syncNowAction() (solo SUPERADMIN) → syncExternalBrackets().

Task F1.6: Alerta de fallo
  - src/services/email-service.ts: sendSyncAlertEmail({ to, source, error }).
  - src/components/emails/sync-alert-email.tsx (template, espeja curation-email).
  - syncExternalBrackets() dispara la alerta al superadmin ante fallo de una fuente.

Task F1.7: UI pública /cuadros
  - RESERVED_SLUGS += 'cuadros' (src/lib/slug.ts); proxy.ts: /cuadros y /cuadros/* públicos sin sesión.
  - src/app/cuadros/page.tsx: index de torneos (live + archived), orden por fecha, badge "finalizado",
    "actualizado hace X".
  - src/app/cuadros/[torneo]/page.tsx: categorías del torneo.
  - src/app/cuadros/[torneo]/[categoria]/page.tsx: render del bracket (RSC lee del service).
  - src/components/cuadros/bracket-view.tsx: desktop = árbol completo con conectores (RSC);
    src/components/cuadros/bracket-rounds-mobile.tsx: switcher por rondas ("use client").
    Slot: seed, nombre, ganador resaltado, score, badges Wo./Ret., "pendiente" si no jugado.
  - Suspense + Skeleton.

Task F1.8: Panel admin /admin/cuadros
  - sub-nav admin: Curado | WhatsApp | Cuadros.
  - estado por fuente/torneo (lastSyncedAt, lastSyncError), botón "sincronizar ahora".

# ===== Fase 2 — AUT Grados / MUR (adapter fino, reusa modelo + UI) =====
Task F2.1: Adapter mur-supabase (puro)
  - src/lib/cuadros/adapters/mur-supabase.ts: PostgREST con MUR_SUPABASE_ANON_KEY.
    discoverTournaments (filtro nameFilter), discoverCategories (tournament_circuits),
    fetchBracket (matches + join en cliente a registrations por player_name; select PII-safe),
    identityKey = 'mur:<uuid>'. round != bracket → null (grupos en F3).
  - rondas explícitas (round string) → mapear a label/index.
Task F2.2: Registrar la fuente MUR en el registry + env. Backfill de etapas pasadas (UUIDs estables).
Task F2.3: Verificar que la UI/modelo renderizan MUR sin cambios; ajustar labels si hace falta.

# ===== Fase 3 — Round-robin (Academia SERIE) =====
Task F3.1: parser SERIE (research § 4.2): matriz head-to-head espejada → standings.
  NormalizedGroupStage (format ROUND_ROBIN) en el mismo `data`.
Task F3.2: UI de grupos/posiciones (tablas) bajo /cuadros/[torneo]/[categoria].
```

### Per-Task Pseudocode (puntos clave)

```
# syncExternalBrackets() — orquestador (F1.4)
for source of SOURCES:
  try:
    adapter = adapterFor(source.type)
    tournaments = adapter.discoverTournaments(source.config)
    seenKeys = []
    for t in tournaments:
      key = adapter.identityKey(t)               # contenido (Academia) | locator (MUR)
      seenKeys.push(key)
      tournamentRow = upsertTournament(key, { sourceType, name, startDate, status: LIVE })
      for c in adapter.discoverCategories(source.config, t):
        res = adapter.fetchBracket(source.config, c)
        if res == null: continue                 # round-robin en MVP → omitir
        hash = sha256(res.raw)
        upsertBracket(tournamentRow.id, c.slug, { data: res.normalized, rawHash: hash, rawSnapshot: res.raw })
    # flip: torneos de esta fuente que ya no aparecen → ARCHIVED (se congelan, no se borran)
    archiveMissing(source.type, seenKeys)
  catch e:
    recordSyncError(source.type, e)              # no aborta las otras fuentes
    sendSyncAlertEmail({ to: superadmins, source: source.type, error: e })
```

---

## Validation Loop

### Level 1 — Tipos / Prisma
```bash
pnpm run typecheck
pnpm prisma validate
pnpm db:migrate --name cuadros_externos
```

### Level 2 — Parser (unit)
```bash
# Tests del parser de Academia contra fixtures CSV reales (bracket cat D + una SERIE → null).
# Verificar: ganador por posición pese a typos; rondas re-etiquetadas por geometría; tokens Wo./Ret.
```

### Level 3 — Build
```bash
pnpm run build
```

### Level 4 — Manual E2E
- Disparar sync (botón en /admin/cuadros) → la planilla de Academia aparece en /cuadros con su bracket.
- Bracket legible en mobile (por rondas) y desktop (árbol); seed/ganador/score/badges correctos.
- Simular flip (cambiar el header de etapa en un fixture o esperar el flip real) → torneo viejo `archived` y visible, nuevo `live`.
- Romper la fuente (env mal / URL inválida) → UI sigue sirviendo el último bueno + llega email de alerta + error en /admin/cuadros.
- (F2) AUT/MUR aparece con la misma UI; verificar que NO se guardó/mostró PII.

---

## Final Checklist

### Arquitectura
- [ ] Solo `services/` importa `@/lib/prisma`; adapters/parsers en `src/lib/cuadros/` son puros (testeables sin DB).
- [ ] `sourceType` es String (adapters nuevos sin migración); `identityKey` `@unique`; upsert por `identityKey`, no por locator.
- [ ] Cron `/api/cron/sync-cuadros` con CRON_SECRET fail-closed; `proxy.ts` deja `/cuadros/*` público.
- [ ] Anon key de MUR y API key de Sheets en env; nunca en DB ni en el cliente.

### Comportamiento
- [ ] Flip de Academia → `archived` (no se pisa); torneos pasados visibles. (ADR 0003)
- [ ] Fallo de sync sirve último bueno + alerta email + estado en /admin; nunca rompe `/cuadros`.
- [ ] Ganador por posición (no por string); rondas por geometría; tokens Wo./Ret. reconocidos.
- [ ] PII de MUR nunca persistida ni mostrada.
- [ ] Sumar torneo del mismo tipo = una entrada en el registry; sin tocar schema ni UI.

### Calidad
- [ ] Strings en español con tildes; controles con `src/components/ui/*`.
- [ ] RSC por defecto; "use client" solo en el switcher de rondas mobile. Suspense + Skeleton.
- [ ] Dos layouts reales (mobile por rondas / desktop árbol), no un árbol scrolleado.

---

## Anti-Patterns

- ❌ NO keyear el torneo externo por `spreadsheetId`/locator (pisa torneos al flipear — el bug real). Keyear por `identityKey`.
- ❌ NO matchear el ganador de Academia por igualdad de string (hay typos). Por posición.
- ❌ NO confiar en los textos de header de columna de la planilla (corridos 1 col). Re-etiquetar por geometría.
- ❌ NO usar Prisma fuera de services; los parsers son puros.
- ❌ NO almacenar ni mostrar PII de MUR.
- ❌ NO romper la UI cuando una fuente cae: servir último bueno + alertar.
- ❌ NO hardcodear gids/categorías: auto-discover.
- ❌ NO cruzar nombres del cuadro con `Player`/usuarios en el MVP (post-feature).

---

## Preguntas resueltas (grill-me 2026-06-08)

- ✅ **Modelo:** nuevo y separado del dominio privado.
- ✅ **Formatos:** bracket-only MVP; round-robin F3.
- ✅ **Registro de fuentes:** config en código; instancia = config, tipo = adapter.
- ✅ **Persistencia:** torneo + cuadro-por-categoría con draw normalizado en JSON + raw + hash.
- ✅ **Sync:** cron dedicado ~6h + botón manual; fallo → último bueno + alerta email + estado admin.
- ✅ **Identidad/flip:** por contenido (Academia) / locator (MUR); archive-on-flip (ADR 0003).
- ✅ **Ruta/acceso:** `/cuadros` público.
- ✅ **UI:** mobile por rondas / desktop árbol completo.
- ✅ **Fasing:** Academia → MUR → round-robin.

## Preguntas abiertas (no bloqueantes)

- **Límite de cron del plan Vercel** (Hobby vs Pro) — define si "cada 6h" aplica o el botón manual es el escape principal.
- **Forma exacta del cuadro normalizado** — el contrato de `src/lib/cuadros/types.ts` se afina al implementar el parser de F1 (play-ins, draws no-potencia-de-2).
- **`GOOGLE_SHEETS_API_KEY`** — usarla para enumerar hojas robusto, o vivir con el scrape de `htmlview`. Se decide en el plan de F1.

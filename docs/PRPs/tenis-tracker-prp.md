# PRP: Tenis Tracker (MVP)

**Feature doc:** diseñado vía `/grill-me` (no hay borrador en `docs/new-features/`).
**Glosario:** [`docs/context.md`](../context.md) — lenguaje canónico, este PRP lo usa sin redefinirlo.
**Estado:** Listo para implementar.

---

## Goal

Que un jugador amateur lleve el log de su carrera tenística: registra los torneos que juega, sus partidos por ronda (rival + marcador) y ve su recorrido en una **línea de tiempo** expandible y un **dashboard de estadísticas**. La app es multi-usuario: cada quien tiene su carrera privada, pero **Torneos, Categorías y Sedes** viven en un **catálogo compartido curado** por el superadmin.

## Why

- Hoy no existe un registro personal de carrera amateur: los resultados quedan en la web de cada club, dispersos y efímeros.
- Un log propio habilita estadísticas (récord, títulos, head-to-head) que motivan y miden progreso.
- El catálogo compartido evita que cada usuario recree los mismos torneos/sedes y sienta las bases sociales para features futuras (head-to-head entre usuarios, rankings).

## What

Cuatro bloques funcionales:

1. **Carrera privada**: el usuario crea una **Participación** (Torneo + Categoría) y carga sus **Partidos** (Programado → Jugado), con marcador por sets y desenlaces especiales. El resultado del torneo se deriva.
2. **Timeline + detalle**: línea de tiempo de torneos (más reciente primero) expandible a partidos por ronda.
3. **Estadísticas**: dashboard derivado del log.
4. **Catálogo compartido + moderación**: creación libre (entradas `pending` visibles solo al creador) + cola de curado del superadmin (aprobar / fusionar duplicados).

### Success Criteria

- [ ] Crear Participación única por (usuario, Torneo, Categoría).
- [ ] Cargar Partido `Programado` (ronda + rival) y luego completarlo a `Jugado` con marcador por sets; el ganador se deriva.
- [ ] Soporte de desenlaces: `walkover`, `retiro` (marcador parcial + quién abandonó) y `bye` (sin rival ni marcador).
- [ ] Marcador estructurado por sets, incluyendo 3er set como super tie-break a 10 (sin diferencia de 2).
- [ ] Resultado del torneo derivado correctamente: `Campeón` / `Finalista` / `Semifinalista` / `Eliminado en {Ronda}` / `En curso`.
- [ ] Timeline de torneos del usuario, más reciente primero, con badge de resultado; expandible a partidos por ronda (rival, marcador, W/L).
- [ ] Dashboard: récord W/L global + win%; conteo de títulos / finales / semifinales; récord por categoría y por año; head-to-head por rival (en el log propio).
- [ ] Entradas de catálogo curado (Torneo/Categoría/Sede) nacen `pending` y son visibles/seleccionables **solo por su creador** hasta aprobarse; al aprobarse quedan disponibles para todos.
- [ ] Panel superadmin: aprobar entradas `pending` y fusionar/reasignar una duplicada a la entrada canónica (reapunta referencias).
- [ ] Toda query de carrera scopeada por `userId`; el superadmin ve/edita todo.
- [ ] `pnpm typecheck` y `pnpm build` sin errores.

---

## Decisiones cerradas (no re-discutir)

| Tema | Decisión |
|---|---|
| **Tenant** | Carrera privada por usuario + **catálogo compartido** (Torneo, Categoría, Sede, Jugador). |
| **Propiedad del Partido** | Privado por usuario. Si dos usuarios jugaron entre sí, hay dos registros independientes (uno en cada log). Sin head-to-head entre usuarios en el MVP. |
| **Granularidad** | Solo el **recorrido propio** (mis partidos), no el cuadro completo ni los demás jugadores. Solo cuadro principal (sin consolación). |
| **Participación** | Atada a (Torneo + Categoría). Los partidos cuelgan de ella. Única por (usuario, torneo, categoría). |
| **Categoría** | Etiqueta curada **plana**; el vocabulario depende del organizador (Grados AUT: `2da`–`7ma`; Academia MG: `A`–`E`). Sin entidad "serie/circuito" en el MVP. |
| **Marcador** | Estructurado por sets (mis games vs games del rival). Ganador derivado. 3er set puede ser super TB a 10. |
| **Desenlaces** | `normal`, `walkover`, `retiro` (parcial + quién abandonó), `bye` (sin rival ni marcador). |
| **Estados del partido** | `scheduled` (rival + ronda, sin marcador) → `played` (con marcador). |
| **Resultado del torneo** | **Derivado** del último partido + su ronda. No se marca a mano. |
| **Gobernanza catálogo** | Creación abierta; entrada `pending` visible **solo al creador**; superadmin aprueba → `approved` (visible a todos). Superadmin puede fusionar/reasignar duplicados. |
| **Jugador** | Catálogo compartido **sin gate** (creación libre). Guarda solo el **nombre**. Dedup con IA es post-MVP. |
| **Roles** | `USER` / `SUPERADMIN` (god mode: ve y edita todo). Un superadmin en el MVP. |
| **Auth** | NextAuth v5 con **Credentials provider** + **OTP numérico** de 6 dígitos (tabla `OtpToken`), enviado por **Resend** + React Email. Sesión **JWT** (rol en el token). Sin `@auth/prisma-adapter`. `@prisma/adapter-neon` para el driver. Patrón replicado de OnMind. |
| **Registro** | **Self-signup abierto**: en `/login` se hace upsert del email (crea `USER` si no existe) y se manda el OTP. Requiere dominio verificado en Resend para entregar a terceros. |
| **Superadmin (seed)** | Upsert de `rapha.uy@rapha.uy` como `SUPERADMIN` en el seed. |
| **Rutas** | `/` landing pública · `/login` auth · `/app/*` autenticado (timeline `/app`, stats `/app/stats`) · `/admin/*` solo SUPERADMIN. `proxy.ts` protege `/app` y `/admin`. |
| **Rama/género** | Fuera del MVP (se asume Masculino). |
| **Schema** | Se migra **completo** en la Fase 0 (todas las entidades de una vez). |

---

## All Needed Context

### Documentation & References

```yaml
- file: docs/context.md
  why: Glosario canónico (Torneo, Categoría, Sede, Participación, Partido, Ronda, Jugador, Resultado, catálogo, roles).

- file: CLAUDE.md
  why: Convenciones obligatorias — capas, naming, qué NO hacer, español con tildes.

- file: AGENTS.md
  why: Este Next.js 16 tiene breaking changes vs training data; leer node_modules/next/dist/docs/ antes de codear APIs nuevas.

- url: node_modules/next/dist/docs/
  why: Referencia local de Next.js 16 (App Router, proxy.ts, RSC). Heed deprecation notices.
```

### Known Gotchas

```typescript
// CRITICAL: Solo src/services/* importa @/lib/prisma. Actions delegan en services.
// CRITICAL: Toda query de carrera filtra por userId de la sesión.
//           Catálogo: visible si status=APPROVED OR createdById=userId (SUPERADMIN ve todo).
// CRITICAL: Next.js 16 — usar src/proxy.ts, NO middleware.ts.
// CRITICAL: Sin try/catch en services (lanzan throw; los actions catchean y devuelven ActionResult).
// CRITICAL: Sin clases en services — funciones.
// PATTERN: Resultado del torneo es DERIVADO (no se persiste como verdad editable).
// PATTERN: "use client" solo en forms/interacción; loading con Suspense + Skeleton (no loading.tsx).
// PATTERN: Jugador NO tiene status (compartido sin gate). Torneo/Categoría/Sede SÍ.
```

---

## Implementation Blueprint

### Data Models

`prisma/schema.prisma` (migrar completo en Fase 0):

```prisma
enum UserRole       { USER  SUPERADMIN }
enum CatalogStatus  { PENDING  APPROVED }
enum Round          { CLASIFICACION  R32  R16  OCTAVOS  CUARTOS  SEMIFINAL  FINAL }  // orden = orden del enum
enum MatchStatus    { SCHEDULED  PLAYED }
enum MatchType      { NORMAL  WALKOVER  RETIRO  BYE }
enum MatchSide      { ME  OPPONENT }   // ganador derivado / quién se retiró

model User {
  id        String     @id @default(cuid())
  email     String     @unique
  name      String?
  role      UserRole   @default(USER)
  isActive  Boolean    @default(true)   // permite bloquear login a futuro
  createdAt DateTime   @default(now())
  entries   Entry[]
  otpTokens OtpToken[]
  // relaciones inversas de createdBy en catálogo (venues, categories, tournaments, players)
}

model OtpToken {   // OTP numérico de 6 dígitos (auth)
  id        String    @id @default(cuid())
  userId    String
  token     String    // 6 dígitos
  expiresAt DateTime  // ~10 min
  usedAt    DateTime? // single-use; se invalida el anterior al pedir uno nuevo
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model Venue {       // Sede (curado)
  id          String        @id @default(cuid())
  name        String
  status      CatalogStatus @default(PENDING)
  createdById String
  mergedIntoId String?      // si fue fusionada a una canónica
  // ...timestamps, relaciones (tournaments, createdBy)
}

model Category {    // (curado) etiqueta plana: "7ma", "A", ...
  id          String        @id @default(cuid())
  name        String
  status      CatalogStatus @default(PENDING)
  createdById String
  mergedIntoId String?
  // ...
}

model Tournament {  // (curado)
  id          String        @id @default(cuid())
  name        String
  venueId     String
  startDate   DateTime?
  endDate     DateTime?
  status      CatalogStatus @default(PENDING)
  createdById String
  mergedIntoId String?
  // ...
}

model Player {      // Jugador / rival (SIN status — compartido sin gate)
  id          String   @id @default(cuid())
  name        String
  createdById String
  // ...
}

model Entry {       // Participación (privada) — única por (user, tournament, category)
  id           String   @id @default(cuid())
  userId       String
  tournamentId String
  categoryId   String
  matches      Match[]
  @@unique([userId, tournamentId, categoryId])
}

model Match {       // Partido (privado)
  id           String      @id @default(cuid())
  entryId      String
  round        Round
  opponentId   String?     // null si BYE
  status       MatchStatus @default(SCHEDULED)
  type         MatchType   @default(NORMAL)
  scheduledAt  DateTime?
  winner       MatchSide?  // derivado al pasar a PLAYED (null si BYE/aún programado)
  retiredBy    MatchSide?  // solo en RETIRO
  sets         Json?       // [{ myGames, oppGames }] ordenado; null en WALKOVER/BYE
  // ...timestamps
  @@index([entryId])
}
```

Relaciones inversas de `createdById` en `User` para Venue/Category/Tournament/Player.

### Task List

```yaml
# El detalle fino de cada fase se cierra con /grill-me + plan mode. Esto es el blueprint global.

Task A: Schema + migración completa (Fase 0)
  - MODIFY: prisma/schema.prisma (todos los enums + modelos de arriba)
  - RUN: pnpm db:migrate --name init_tenis_tracker
  - SEED: sedes (Los Horneros Raquet Club, Academia MG) + categorías (2da–7ma, A–E) como APPROVED.

Task B: Auth + roles + proxy (Fase 0)
  - NextAuth v5 OTP por email; sesión expone userId + role.
  - src/proxy.ts protege rutas privadas y /admin (solo SUPERADMIN).

Task C: Services de catálogo (Fase 1)
  - venue-service / category-service / tournament-service / player-service.
  - Visibilidad: where status=APPROVED OR createdById=userId (SUPERADMIN sin filtro).
  - Crear → PENDING (salvo Player, sin status).

Task D: Service de carrera (Fase 1)
  - entry-service: crear/obtener Participación (única por user+tournament+category).
  - match-service: crear Programado, completar a Jugado, derivar winner, manejar walkover/retiro/bye.
  - deriveTournamentResult(entry): ver pseudocódigo.

Task E: Actions + validaciones (Fase 1)
  - actions.ts por ruta + Zod en src/lib/validations/. ActionResult<T> + revalidatePath.

Task F: UI timeline + carga (Fase 1)
  - Timeline RSC (más reciente primero, badge resultado), expand → partidos por ronda.
  - Forms "use client" para crear participación / cargar partido.

Task G: Dashboard de stats (Fase 2)
  - stats-service: récord W/L + win%, títulos/finales/semis, por categoría y año, head-to-head.

Task H: Catálogo compartido + moderación (Fase 3)
  - Aplicar visibilidad pending/approved end-to-end.
  - /admin: cola de pending (Torneo/Categoría/Sede), aprobar, fusionar/reasignar (mergedIntoId + reapuntar refs).
  - Autocomplete de jugadores compartidos al cargar rival.
```

### Per-Task Pseudocode (punto clave)

#### `deriveTournamentResult` (resultado del torneo)

```typescript
// Ordena por el orden del enum Round (CLASIFICACION..FINAL).
export function deriveTournamentResult(matches: Match[]): EntryResult {
  if (matches.some(m => m.status === 'SCHEDULED')) return 'EN_CURSO'
  const played = matches.filter(m => m.status === 'PLAYED')
  if (played.length === 0) return 'EN_CURSO'

  const last = maxBy(played, m => ROUND_ORDER[m.round])   // partido de mayor ronda jugado
  if (last.round === 'FINAL')      return last.winner === 'ME' ? 'CAMPEON' : 'FINALISTA'
  if (last.round === 'SEMIFINAL')  return last.winner === 'ME' ? 'EN_CURSO' : 'SEMIFINALISTA'
  // perdió antes de semis
  return last.winner === 'ME' ? 'EN_CURSO' : `ELIMINADO_EN_${last.round}`
}
// Nota: winner === 'ME' en una ronda < FINAL sin partido posterior ⇒ datos incompletos ⇒ EN_CURSO.
```

---

## Validation Loop

### Level 1: Tipos
```bash
pnpm run typecheck   # 0 errores
```

### Level 2: Prisma
```bash
pnpm prisma validate
pnpm db:migrate --name init_tenis_tracker
```

### Level 3: Build
```bash
pnpm run build       # build exitoso
```

### Level 4: Manual E2E
El dueño carga sus ~6 torneos reales (incluido el AUT 7ma ganado y el de 6ta perdido en 2da ronda); la timeline muestra los resultados correctos; las stats cuadran.

---

## Final Checklist

### Arquitectura
- [ ] Solo `services/` importa `@/lib/prisma`.
- [ ] Validaciones Zod en `lib/validations/`.
- [ ] Server actions sobre API routes (API routes solo para externos / auth).
- [ ] Carrera scopeada por `userId`; catálogo por `status`/`createdById`.
- [ ] `proxy.ts` (no `middleware.ts`); `/admin` solo SUPERADMIN.

### Comportamiento
- [ ] Resultado del torneo derivado (no editable a mano).
- [ ] Participación única por (user, torneo, categoría).
- [ ] Entradas curadas nacen PENDING y solo las ve el creador hasta aprobarse.
- [ ] Fusión reapunta referencias a la entrada canónica.

### Calidad
- [ ] Sin try/catch ni clases en services.
- [ ] `"use client"` solo con interactividad; Suspense + Skeleton (no `loading.tsx`).
- [ ] Strings en español con tildes (á é í ó ú ñ).

---

## Anti-Patterns

- ❌ NO modelar el cuadro completo ni a los demás jugadores — solo el recorrido propio.
- ❌ NO persistir el resultado del torneo como dato editable — derivarlo.
- ❌ NO gatear la creación de Jugadores (compartidos sin aprobación).
- ❌ NO usar Prisma fuera de services ni crear API routes para consumo interno.
- ❌ NO meter rama/género, consolación ni serie/circuito en el MVP (post-MVP).

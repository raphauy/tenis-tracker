# Roadmap — Tenis Tracker (MVP)

Plan por fases secuenciales de la feature. PRP completo en [`tenis-tracker-prp.md`](./tenis-tracker-prp.md). Lenguaje del dominio en [`../context.md`](../context.md).

## Cómo usar este documento

**Para el desarrollador:** única fuente de verdad del orden de implementación. Cada fase se valida con el usuario antes de pasar a la siguiente.

**Para el LLM:**
1. Al abrir una sesión de planificación o implementación, leer este doc + el PRP.
2. Buscar la **primera fase con `Estado: pendiente`** cuyas dependencias estén todas en `hecha`.
3. Entrar a `/grill-me` + plan mode usando `Alcance` + `Criterios de "hecha"` de esa fase como input. Cruzar con el PRP para los detalles técnicos (no re-discutir las "Decisiones cerradas").
4. NO avanzar de fase sin que el usuario lo confirme.

## Estados

- `pendiente` — no comenzada
- `en curso` — en desarrollo activo
- `hecha` — validada por el usuario, mergeada y deployada

---

## Fase 0 — Fundaciones

- **Estado:** hecha
- **Objetivo:** dejar el proyecto listo para construir features: stack de datos, auth con roles, schema **completo** del MVP y seeds reales. Al cerrar esta fase no hacen falta más migraciones para el MVP.

**Alcance**

- Prisma 6 + PostgreSQL (Neon) configurados; scripts `db:migrate`, `db:generate`, `db:studio`, `typecheck` en `package.json`.
- Migración Prisma **completa** con todo el schema del MVP de una sola vez: enums (`UserRole`, `CatalogStatus`, `Round`, `MatchStatus`, `MatchType`, `MatchSide`) y modelos (`User`, `Venue`, `Category`, `Tournament`, `Player`, `Entry`, `Match`) + relaciones inversas. Ver PRP § Data Models.
- Seed: sedes (`Los Horneros Raquet Club`, `Academia MG`) y categorías (`2da`–`7ma`, `A`–`E`) como `APPROVED`.
- NextAuth v5 con OTP por email; sesión expone `userId` + `role`. Designación del superadmin (el dueño).
- Roles `USER` / `SUPERADMIN`; `src/proxy.ts` protege rutas privadas y `/admin`.
- shadcn/ui + Tailwind 4 inicializados; layout base en español (`lang="es"`).

**Fuera de alcance**

- Cualquier feature de carrera, catálogo, stats o moderación (fases siguientes).

**Dependencias:** ninguna.

**Criterios de "hecha"**

- `pnpm typecheck` y `pnpm build` pasan.
- Login OTP funciona; existe un superadmin; `proxy.ts` bloquea `/admin` a no-superadmin.
- Migración aplicada; `prisma studio` muestra el schema completo; seeds cargados.

---

## Fase 1 — Log personal (core + timeline)

- **Estado:** hecha
- **Objetivo:** el usuario registra su carrera de punta a punta y la ve en la línea de tiempo. Es la fase que ya le da valor real al dueño.

**Alcance**

- Services de catálogo (`venue`, `category`, `tournament`, `player`): crear/elegir, con visibilidad `status=APPROVED OR createdById=userId` (Player sin status). La creación nace `PENDING` (la cola de curado llega en Fase 3; acá basta con que el creador la use).
- Service de carrera: crear Participación (única por user+torneo+categoría); crear Partido `Programado` (ronda + rival); completar a `Jugado` con marcador por sets; desenlaces `walkover` / `retiro` / `bye`; ganador derivado.
- Derivación del resultado del torneo (`deriveTournamentResult`): Campeón / Finalista / Semifinalista / Eliminado en {Ronda} / En curso.
- Actions + validaciones Zod (`ActionResult<T>`, `revalidatePath`).
- UI: timeline de torneos (más reciente primero) con badge de resultado; expandir torneo → partidos por ronda (rival, marcador, W/L). Forms "use client" para crear participación y cargar/completar partido.

**Fuera de alcance**

- Dashboard de estadísticas (Fase 2).
- Cola de aprobación / visibilidad efectiva pending-vs-approved entre usuarios / fusión (Fase 3).

**Dependencias:** Fase 0 hecha.

**Criterios de "hecha"**

- El dueño carga sus ~6 torneos reales (incluido el AUT 7ma ganado y el de 6ta perdido en 2da ronda) y la timeline los muestra con el resultado derivado correcto.
- Flujo Programado → Jugado funciona; bye / walkover / retiro se cargan y muestran bien.
- Marcador por sets (incl. super TB a 10) se guarda y renderiza correctamente.
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño en uso real.

---

## Fase 2 — Estadísticas

- **Estado:** pendiente
- **Objetivo:** dashboard derivado del log que muestre el progreso de la carrera.

**Alcance**

- `stats-service`: récord W/L global + win%; conteo de títulos, finales y semifinales; récord por categoría y por año; head-to-head por rival (dentro del log propio).
- UI dashboard (`/stats`) RSC, con los cuatro bloques.

**Fuera de alcance**

- Comparativas entre usuarios / rankings (post-MVP).

**Dependencias:** Fase 1 hecha.

**Criterios de "hecha"**

- Los números cuadran con los datos cargados en Fase 1; el "1er título" aparece reflejado.
- Head-to-head contra un rival recurrente es correcto.
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño.

---

## Fase 3 — Catálogo compartido + moderación

- **Estado:** pendiente
- **Objetivo:** prender lo social/curado del catálogo: lo que un usuario crea puede volverse canónico y disponible para todos tras el curado del superadmin.

**Alcance**

- Visibilidad efectiva: entradas `pending` solo para su creador; `approved` para todos (Torneo/Categoría/Sede). Jugadores compartidos a todos (autocomplete al cargar rival).
- Panel superadmin (`/admin`): cola de entradas `pending`; aprobar (`pending` → `approved`); fusionar/reasignar una duplicada a la entrada canónica (setea `mergedIntoId`, reapunta referencias, archiva la duplicada).

**Fuera de alcance**

- Detección de duplicados de jugadores con IA (post-MVP).
- Head-to-head entre usuarios, rama/género, consolación, serie/circuito, dobles (post-MVP).

**Dependencias:** Fase 1 hecha (Fase 2 es independiente; pueden ir en cualquier orden tras la 1).

**Criterios de "hecha"**

- Un segundo usuario crea un torneo `pending` que solo él ve; el superadmin lo aprueba y aparece para todos.
- Una entrada duplicada se fusiona y las participaciones que la referenciaban quedan apuntando a la canónica.
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño.

---

## Post-MVP (fuera del roadmap del MVP)

Cada uno será su **propia feature** con su PRP + roadmap en `docs/PRPs/` (si es chica, una sola fase):

- Detección de duplicados de jugadores con IA (avisa al superadmin, no auto-cura).
- Head-to-head entre usuarios.
- Cuadros de consolación (Copa de Plata).
- Rama/género (Masculino/Femenino).
- Entidad circuito/serie del torneo (AUT social, Babolat Tour…).
- Dobles.
- (Ejemplo de feature futura) chatbot para registrar resultados / crear partidos vía tool calls.

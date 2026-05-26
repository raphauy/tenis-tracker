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

## Fase 1.5 — Perfil público con slug

- **Estado:** hecha
- **Objetivo:** cada jugador tiene una URL propia (`/[slug]`, ej. `/raphael-carvalho`) que reemplaza a `/app` como su espacio. El perfil es público por defecto (compartible) o privado, a elección del dueño. El log deja de vivir en una ruta fija y pasa a colgar del slug.

**Decisión técnica de base (cerrada)**

- El slug vive en `User` (la cuenta que loguea), no en el `Player` del catálogo.
- `/[slug]` en la raíz es viable: Next.js resuelve estático > dinámico, así que `/login`, `/admin`, `/api` ganan siempre sobre `/[slug]`. El costo es mantener una **blocklist de slugs reservados** sincronizada con toda ruta estática top-level (presente y futura) + internos de Next.

**Alcance**

- **Schema:** `User` gana `slug` (único, nullable hasta el onboarding) y `visibility` (público/privado, default público). Migración nueva (esta feature es posterior al "schema completo" de Fase 0).
- **Onboarding obligatorio:** tras el primer login, si el usuario no tiene slug, se lo fuerza a elegir uno antes de usar la app. Validación de disponibilidad (único) + rechazo de slugs reservados (`login`, `admin`, `api`, internos de Next, y lo que se agregue). El slug queda **fijo** (no editable self-service en el MVP).
- **Reestructura de rutas:** `/app/*` → `/[slug]/*`. El perfil (`/[slug]`) muestra la timeline; las subrutas de carga/edición (`/[slug]/nuevo`, `/[slug]/participacion/[entryId]`) cuelgan del slug y son **solo del dueño**.
- **Modo lectura vs. dueño:** un visitante (anónimo o no-dueño) ve la timeline **read-only** (sin acciones de carga/edición); el dueño ve su perfil con todos los controles.
- **Visibilidad:** página de configuración (`/[slug]/configuracion` o similar) con el toggle público/privado. Si es privado, un no-dueño recibe 404/login.
- **Stats placeholder:** crear la page de stats del perfil (`/[slug]/stats` o pestaña) con un estado "En desarrollo". Queda enganchada para que, al llegar Fase 2, aparezca sola en el link público.
- **`proxy.ts` reescrito:** quitar el hardcodeo de `/app`. Reglas: `/[slug]` público accesible sin sesión; privado → login/404 si no es el dueño; subrutas de edición exigen sesión + ser dueño; `/admin` sigue solo SUPERADMIN; `/` con sesión redirige al `/[slug]` propio.

**Fuera de alcance**

- Cambiar el slug self-service (post-MVP; por ahora cambio manual si hace falta).
- Stats reales (Fase 2): acá solo el placeholder.
- Compartir/visibilidad granular por torneo, vanity preview/OG, redirects de slugs viejos.

**Dependencias:** Fase 1 hecha. (Fase 2 pasa a depender de esta: el dashboard se monta dentro del perfil.)

**Criterios de "hecha"**

- Un usuario nuevo es forzado a elegir slug en el onboarding; no puede tomar uno reservado ni uno ya usado.
- El dueño accede a su carrera en `/[slug]` y carga/edita en `/[slug]/nuevo`, etc.; la antigua `/app` ya no existe.
- Un perfil público es visible read-only sin sesión; uno privado bloquea a no-dueños.
- `/[slug]/stats` muestra el placeholder; `/` logueado redirige al slug propio; `/login` y `/admin` siguen funcionando.
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño.

---

## Fase 2 — Estadísticas

- **Estado:** hecha
- **Objetivo:** dashboard derivado del log que muestre el progreso de la carrera.

**Alcance**

- `stats-service`: récord W/L global + win%; conteo de títulos, finales y semifinales; récord por categoría y por año; head-to-head por rival (dentro del log propio).
- UI dashboard dentro del perfil (`/[slug]/stats`, reemplaza el placeholder de Fase 1.5) RSC, con los cuatro bloques.

**Fuera de alcance**

- Comparativas entre usuarios / rankings (post-MVP).

**Dependencias:** Fase 1.5 hecha (el dashboard vive bajo el slug).

**Criterios de "hecha"**

- Los números cuadran con los datos cargados en Fase 1; el "1er título" aparece reflejado.
- Head-to-head contra un rival recurrente es correcto.
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño.

---

## Fase 3 — Catálogo compartido + moderación

- **Estado:** hecha
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

# Research: Cuadros de los AUT Grados desde MUR Academy

> **Tipo:** investigación de **factibilidad**. Pregunta que responde: *¿se puede leer la data de los cuadros de
> los AUT Grados (web de MUR Academy) y mostrarlos en UI?* → **Sí, y bastante más fácil que La Academia MG**
> (ver § 7).
> **Fecha:** 2026-06-08.
> **Alcance:** SOLO factibilidad y documentación de la fuente. Las decisiones de diseño (esquema, cómo encaja
> con el dominio de Tenis Tracker, alcance del MVP, etc.) **no se resuelven acá** — quedan como notas sueltas en
> § 8 para el agente que diseñe la feature.
> **Comparar con:** [`cuadros-academia-mg-google-sheets.md`](./cuadros-academia-mg-google-sheets.md) — mismo
> objetivo (mostrar brackets en UI), fuente opuesta (planilla manual vs API relacional). Ver § 6.

## 1. Contexto

Los **AUT Grados** son torneos de la AUT que se publican en la web de **MUR Academy** (`muracademy.com`), no en
una planilla. Se juegan por **etapas** periódicas; cada etapa es un torneo con varias categorías. Las etapas
**alternan categorías**: las pares ("Grados AUT 2a, 4a, 6a") y las impares ("Grados AUT 3a, 5a, 7a") →
entre dos etapas consecutivas cubren **2da a 7ma**. El objetivo es el mismo que con La Academia MG: **leer los
cuadros y mostrarlos en una UI linda**, refrescando cada cierto tiempo.

- Listado de torneos: `https://www.muracademy.com/torneos`
- Etapa de ejemplo (la usada en esta investigación): `…/torneos/cb47489e-234c-47cc-a010-3612bc4d2dc7`
  → nombre real: **"Grados AUT 2a, 4a, 6a"**, `start_date` 2026-05-10.
- Categoría de ejemplo (6ta, que jugó el usuario):
  `…/circuito/8f457ad1-0ef0-4f70-a7b8-c189b083cbe0` → categoría **"Sexta"**.

## 2. Fuente de datos: web Next.js + backend Supabase (PostgREST)

- `muracademy.com` es una app **Next.js (App Router) en Vercel** (RSC). Confirmado por headers:
  `server: Vercel`, `x-powered-by: Next.js`, `x-matched-path: /torneos/[id]/circuito/[circuitId]`.
- El backend es **Supabase (Postgres)** expuesto por **PostgREST**: `https://tsxzhdnyykknmivdpyzv.supabase.co`.
- **Hallazgo clave:** el sitio **embebe la `anon key` de Supabase en el bundle JS del cliente** (chunk
  `_next/static/chunks/…`, junto a `createClient`). Con esa key (role `anon`) la **REST API responde lectura
  pública** — el RLS de MUR permite `SELECT` anónimo en las tablas relevantes. Confirmado con `curl`:
  `GET https://…supabase.co/rest/v1/<tabla>` → `HTTP 200`, JSON normalizado.

> Esto cambia todo respecto de Academia MG: **no hace falta parsear nada** (ni DOM, ni el payload RSC, ni CSV
> posicional). Se consulta la API y se obtiene el modelo relacional ya estructurado. (El HTML server-rendered
> también es scrapeable como plan B, pero la API es muy superior.)

## 3. Modelo de datos (tablas leídas, lectura anónima confirmada)

Tablas relevantes y sus columnas (las descubiertas; PostgREST filtra nombres de tablas vecinas en los 404):

### `tournaments` — las etapas
`id, name, description, start_date, end_date, registration_deadline, max_participants, entry_fee, category,
level, status, image_url, location, deleted, created_at, updated_at`
→ 13 torneos visibles. Filtrando por nombre se listan las etapas AUT Grados.

### `tournament_circuits` — las categorías de cada etapa
`id, tournament_id, name ("Segunda"/"Cuarta"/"Sexta"…), max_participants, bracket_size (32),
bracket_type ("single_elimination"), allow_byes, status, display_order, point_group_id, deleted`

### `matches` — **el bracket** (lo importante)
`id, tournament_id, circuit_id, round ("Ronda de 32"/"Ronda de 16"/"Cuartos de Final"/"Semifinal"/"Final"),
match_number, player1_id, player2_id, player1_score ("2-6, 1-6"), player2_score ("6-2, 6-1"), winner_id,
status ("completed"/"scheduled"), bracket_type ("main"), scheduled_time, court_number, phase_id, group_id,
p1_sets, p2_sets, p1_games, p2_games, created_at, updated_at`

### `registrations` — inscripciones por torneo/categoría (resuelve nombres + siembra)
`id, tournament_id, circuit_id, player_id, player_name, seed_position, payment_status, registration_date,
notes, cancelled_at, amount_paid …` **+ PII:** `player_email, phone, birth_date, skill_level`.

### `players` — jugadores globales (también tienen página `/jugadores/<id>` en la web)
`id, user_id, full_name, profile_image_url, bio …` **+ PII:** `email, phone, birth_date, skill_level`.

### Relaciones (verificadas)
- `matches.circuit_id → tournament_circuits.id` (la categoría).
- `matches.tournament_id → tournaments.id` (la etapa).
- **`matches.player1_id / player2_id → registrations.id`** (¡NO a `players.id`!). `registrations.player_name`
  da el nombre a mostrar; `registrations.player_id → players.id` es la identidad global.
- **OJO:** el *embedding* por FK de PostgREST (`select=…,players(...)`) **no funciona** (no hay FK declarada en
  el schema cache). Los nombres se resuelven con una **segunda request** a `registrations` y join en cliente.
- Soporte de fases/grupos (round-robin) existe en el schema (`phase_id`, `group_id`, tabla `phase_groups`),
  pero en los AUT Grados es `single_elimination` y esos campos vienen `null`. → **un solo formato a soportar.**

## 4. Cómo se arma un bracket (receta — prueba de factibilidad)

Para una categoría (p. ej. la 6ta del ejemplo, `circuit_id = 8f457ad1…`):

1. **Etapas:** `GET /tournaments` (+ filtro por nombre `ilike.*grados*`).
2. **Categorías de la etapa:** `GET /tournament_circuits?tournament_id=eq.<TID>&order=display_order`.
3. **Partidos de la categoría:** `GET /matches?circuit_id=eq.<CID>&order=match_number`.
4. **Entrantes/nombres:** `GET /registrations?circuit_id=eq.<CID>&select=id,player_name,seed_position,player_id`.
5. **Join en cliente:** `match.playerN_id → registration.id → player_name`.

Todo viene explícito: la **ronda** es un string claro, el **ganador** es `winner_id`, el **score** es un string
por jugador (`"3-6, 6-4, 10-8"`, incluye super tie break `10-8`). **No hay inferencia posicional.**

La 6ta del ejemplo: **31 matches** = `Ronda de 32` (16) → `Ronda de 16` (8) → `Cuartos de Final` (4) →
`Semifinal` (2) → `Final` (1). Cuadro de 32 single-elimination, `bracket_type: "main"` (= "Copa de Oro" en la
UI de MUR). Reconstruido idéntico a la captura (ver Apéndice B).

> **`bracket_type`:** acá todo es `"main"`. Otros valores aparecerían para cuadros de consolación
> (Copa de Plata/Bronce — algún torneo los menciona). A contemplar si se quiere mostrar las consolaciones.

## 5. Riesgos y consideraciones

- **API no oficial / no documentada.** Usamos la `anon key` extraída de su bundle (es la key pública de browser
  y el RLS permite `SELECT` anónimo → leemos lo que el sitio ya sirve públicamente), pero **no es una API con
  contrato**: MUR puede **rotar la key, endurecer el RLS o cambiar el schema sin aviso** y romper el sync.
  Mitigación: key en env, monitoreo de fallas, guardar la respuesta cruda + hash por sync.
- **PII expuesta.** `registrations` y `players` devuelven **email, teléfono y fecha de nacimiento** de forma
  pública vía la anon key (misconfiguración de RLS de MUR, no nuestra). Para nuestra feature: **seleccionar solo
  lo necesario** (`player_name`, `seed_position`, resultados) y **nunca almacenar ni mostrar PII**.
- **ToS / encuadre.** Leemos el backend de un tercero; los cuadros/resultados son públicos, pero conviene
  confirmar el encuadre antes de publicarlo (atribución a MUR/AUT, etc.).
- **Identidad de jugadores:** los ids son uuids estables; cuidado con que `matches.playerN_id` apunta a
  `registrations.id` (por torneo), no al `players.id` global.

## 6. Comparación con La Academia MG (mismo objetivo, fuente opuesta)

| Dimensión            | La Academia MG (Google Sheet)            | AUT Grados (MUR Academy / Supabase)        |
|----------------------|------------------------------------------|--------------------------------------------|
| Fuente               | Planilla manual pública (CSV export)     | API relacional (PostgREST + anon key)      |
| Parseo               | **Posicional**, tolerante a ruido        | **Ninguno** — JSON normalizado             |
| Formatos de cuadro   | **Dos** (bracket + round-robin)          | **Uno** (single_elimination); grupos en schema pero sin uso |
| Rondas / ganador     | Inferidos por geometría                  | Explícitos (`round`, `winner_id`)          |
| Typos / identidad    | Sí (match por posición, fuzzy)           | Ids estables (uuids)                        |
| Fragilidad           | Que siga siendo pública la planilla      | Que no roten la anon key / cambien RLS/schema |
| PII                  | No                                       | **Sí, expuesta** (filtrar)                 |

→ Las dos features comparten el **objetivo de UI** (dibujar un bracket de eliminación con conectores), así que
el **componente de cuadro puede ser común**. Lo que difiere es la capa de ingesta.

## 7. Conclusión de factibilidad

- **Se puede, y es más fácil que La Academia MG. Sin bloqueantes técnicos.** La data sale normalizada de una API
  REST con lectura pública (confirmado con `curl`): etapas, categorías, partidos (ronda, ganador, score) y
  nombres, todo con ids. No hay parseo posicional ni ambigüedad.
- **El trabajo real** es: la **UI del bracket** (compartible con Academia MG), el **sync + persistencia**, y
  manejar dos cosas blandas: **no tocar la PII** expuesta y **asumir la fragilidad** de depender de una API no
  oficial (monitoreo + crudo+hash).

## 8. Notas para el diseño de la feature (NO decididas acá)

Apuntes sueltos para no perder contexto; los resuelve quien diseñe la feature (PRP):

- **Forma natural sobre el stack:** un Vercel Cron (el proyecto ya corre `/api/cron/curation` vía `vercel.json`)
  que pega a la REST API de Supabase de MUR → persiste vía service (Prisma/Neon) → la UI (RSC) lee de ahí.
  Misma forma que la feature de Academia MG. Servir desde nuestra persistencia da resiliencia ante cambios/caídas
  de MUR; guardar crudo + hash ayuda a detectar cuándo rompieron el schema.
- **UI de bracket compartida** entre Academia MG (eliminación) y AUT Grados → conviene diseñar el componente de
  cuadro una sola vez.
- **Solapamiento con el dominio actual:** mismo dilema que el doc de Academia MG (§ 7.1 de ese doc) — el cuadro
  público (sin dueño) vs la carrera privada (`Entry`/`Match` por `userId`). Las dos features podrían compartir el
  modelado del "cuadro público".
- **Identidad de jugadores:** `registrations.player_name` / `players.full_name` se podrían cruzar con
  `Player`/usuarios de Tenis Tracker (la app ya tiene perfiles `/[slug]` y canonicalización `mergedIntoId`).
  Acá hay uuids estables → más fácil que en Academia MG.
- **Consolaciones:** `bracket_type` distingue cuadro principal de Plata/Bronce si se quisieran mostrar.
- **Auth/Key:** pinear la anon key en env y tener un plan si MUR la rota (alertar, no fallar silencioso).

## Apéndice A — Endpoints / recetas (reproducibles)

> `tsxzhdnyykknmivdpyzv.supabase.co` es el proyecto Supabase de MUR. La **anon key** de abajo es **su clave
> pública de cliente** (role `anon`, embebida en el bundle JS que sirve a cualquier visitante; `exp` ~2035).
> No es un secreto nuestro; se documenta para reproducibilidad. El riesgo real es que MUR la rote.

```bash
BASE="https://tsxzhdnyykknmivdpyzv.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzeHpoZG55eWtrbm1pdmRweXp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDU0MjMsImV4cCI6MjA4MTEyMTQyM30.kQQiIZzH3QCbmGIMkVnE2gTQNFdfOau2Cnqq6b2qEFE"
AUTH=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")

# Etapas AUT Grados:
curl -s "${AUTH[@]}" "$BASE/tournaments?name=ilike.*grados*&select=id,name,start_date,status&order=start_date.desc"
# Categorías de una etapa:
curl -s "${AUTH[@]}" "$BASE/tournament_circuits?tournament_id=eq.<TID>&order=display_order"
# Partidos de una categoría (el bracket):
curl -s "${AUTH[@]}" "$BASE/matches?circuit_id=eq.<CID>&order=match_number"
# Entrantes/nombres (sin PII):
curl -s "${AUTH[@]}" "$BASE/registrations?circuit_id=eq.<CID>&select=id,player_name,seed_position,player_id"
# Conteo exacto (header Content-Range):
curl -sI "${AUTH[@]}" -H "Prefer: count=exact" -H "Range: 0-0" "$BASE/matches?circuit_id=eq.<CID>&select=id"
```

Cómo obtener la anon key uno mismo: `muracademy.com` → bundle `_next/static/chunks/*.js` que contiene
`createClient` y `…supabase.co` → la key `eyJ…` (role `anon`) está al lado.

## Apéndice B — Ejemplo real reconstruido (6ta del ejemplo, semis + final)

Datos crudos de `matches` (categoría Sexta), con nombres resueltos vía `registrations`. Coincide exacto con la
captura (Ignacio Reis campeón):

```
Semifinal #29: Santiago Risso vs Ignacio Reis | 1-6, 3-6 / 6-1, 6-3 | gana = Ignacio Reis  [completed]
Semifinal #30: Tricca vs Nicolás Blanco       | 6-1, 6-0 / 1-6, 0-6 | gana = Tricca         [completed]
Final     #31: Ignacio Reis vs Tricca         | 3-6, 6-4, 10-8 / 6-3, 4-6, 8-10 | gana = Ignacio Reis  [completed]
```

> El score viene como dos strings espejados (uno por jugador). `10-8` es super tie break. La ronda y el ganador
> son explícitos; no hay que inferir nada.

# Roadmap — Cuadros externos

Plan por fases secuenciales. PRP completo en [`cuadros-prp.md`](./cuadros-prp.md). Factibilidad de las fuentes en [`../research/cuadros-academia-mg-google-sheets.md`](../research/cuadros-academia-mg-google-sheets.md) y [`../research/cuadros-aut-grados-mur-academy.md`](../research/cuadros-aut-grados-mur-academy.md). Keying en [ADR 0003](../adr/0003-identidad-cuadro-externo-por-contenido.md). Lenguaje en [`../context.md`](../context.md) § "Cuadros externos".

## Cómo usar este documento

1. Al abrir sesión de planificación/implementación, leer este doc + el PRP + los dos research.
2. Buscar la **primera fase `pendiente`** con dependencias en `hecha`.
3. `/grill-me` + plan mode usando `Alcance` + `Criterios de "hecha"` de esa fase. Cruzar con el PRP (no re-discutir "Decisiones cerradas").
4. NO avanzar de fase sin confirmación del usuario.

## Estados

- `pendiente` — no comenzada
- `en curso` — en desarrollo activo
- `hecha` — validada por el usuario, mergeada y deployada

---

## Fase 1 — Academia MG (bracket) + fundaciones

- **Estado:** hecha
- **Objetivo:** la feature funciona end-to-end contra la fuente **difícil** (Academia MG): se ve el cuadro de bracket en `/cuadros` con UI mobile + desktop, sincronizado y persistido, con archive-on-flip. Validar la abstracción contra el caso ruidoso de una vez. Esta fase **migra el schema completo de la feature** (sirve también a MUR en F2).

**Alcance**

- **Schema completo** de la feature (migración única): enums `ExternalTournamentStatus`, `BracketFormat`; modelos `ExternalTournament` (parent, una fila por `identityKey`) y `ExternalBracket` (cuadro por categoría, draw normalizado en JSON + `rawHash` + `rawSnapshot`). Ver PRP § Data Models.
- **Tipos + contrato:** `NormalizedBracket` y la interfaz `SourceAdapter`; **registry de fuentes en código** (`src/lib/cuadros/sources.ts`) con la fuente Academia.
- **Adapter `google-sheets-academia`** (puro, en `src/lib/cuadros/`): fetch CSV export, auto-discover de categorías, **parser posicional de bracket** tolerante a ruido (ganador por posición, rondas re-etiquetadas por geometría, tokens `Wo.`/`Ret.`, draws variables), `identityKey` **por contenido**, round-robin se omite (`fetchBracket` → null). Con tests de fixtures reales.
- **Service + orquestador** (`external-bracket-service`, única capa Prisma): upsert por `identityKey`, **archive-on-flip** (lo que deja de aparecer → `ARCHIVED`), `rawHash`, registro de errores por fuente.
- **Sync:** cron dedicado `/api/cron/sync-cuadros` (~cada 6h, patrón `CRON_SECRET`) + **botón "sincronizar ahora"** en `/admin/cuadros`. Fallo de una fuente → servir último bueno + **alerta por email** al superadmin + estado/errores en el panel.
- **UI pública `/cuadros`** (público sin auth; `cuadros` a `RESERVED_SLUGS`; `proxy.ts` lo deja pasar): index de torneos (`live` + `archived`, orden por fecha, badge "finalizado", "actualizado hace X") → categorías → bracket. **Dos layouts:** mobile por rondas / desktop árbol completo con conectores. Seed, ganador resaltado, score crudo, badges, "pendiente".
- **Panel `/admin/cuadros`** (sub-nav admin: Curado | WhatsApp | Cuadros): estado de sync por fuente/torneo + botón manual.

**Fuera de alcance**

- AUT/MUR (F2). Round-robin / grupos (F3). Cross-link de nombres a `/[slug]`, consolaciones (post-feature).

**Dependencias:** ninguna (MVP ya deployado).

**Criterios de "hecha"**

- El cuadro de bracket de Academia MG aparece en `/cuadros` y se renderiza bien en mobile (por rondas) y desktop (árbol); ganador/seed/score/badges correctos pese a typos.
- El flip de etapa archiva el torneo anterior (queda visible, "finalizado") y crea el nuevo — no se pisa.
- Un fallo de la fuente no rompe `/cuadros` (sirve último bueno), alerta por email y queda en `/admin/cuadros`.
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño en uso real.

---

## Fase 2 — AUT Grados / MUR (bracket)

- **Estado:** pendiente
- **Objetivo:** sumar la segunda fuente como **adapter fino** que llena el mismo cuadro normalizado, reusando modelo y UI. Demuestra la extensibilidad: una fuente nueva sin tocar schema ni UI.

**Alcance**

- **Adapter `mur-supabase`** (puro): PostgREST con `MUR_SUPABASE_ANON_KEY`; discover de etapas (filtro de nombre) y categorías (`tournament_circuits`); `fetchBracket` (matches + join en cliente a `registrations` por `player_name`, **select PII-safe**); rondas explícitas → label/index; `identityKey` = `mur:<uuid>`.
- **Registrar** la fuente MUR en el registry + env. **Backfill** de etapas pasadas (UUIDs estables → historial recuperable, a diferencia de Academia).
- Verificar que la UI/modelo renderizan MUR sin cambios.

**Fuera de alcance**

- Round-robin / grupos (F3). Consolaciones (Copa de Plata vía `bracket_type`) y cross-link a `/[slug]` (post-feature).

**Dependencias:** Fase 1 hecha (schema, modelo, UI, sync).

**Criterios de "hecha"**

- Las etapas AUT Grados aparecen en `/cuadros` con la misma UI; bracket reconstruido fiel (ronda/ganador/score explícitos).
- Ninguna PII (email/teléfono/fecha de nacimiento) se almacenó ni se muestra.
- Backfill de etapas pasadas visible como `archived`/histórico.
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño.

---

## Fase 3 — Round-robin (Academia SERIE)

- **Estado:** pendiente
- **Objetivo:** soportar el segundo formato (grupos round-robin) para cubrir las categorías de Academia que no son bracket (Cab A, Damas, Dobles Mixtos/Damas).

**Alcance**

- **Parser SERIE** (research § 4.2): matriz head-to-head espejada por grupo → tabla de posiciones; `NormalizedGroupStage` (`format: ROUND_ROBIN`) en el mismo `data` JSON (sin migración: la columna ya existe desde F1).
- **UI de grupos/posiciones** (tablas) bajo `/cuadros/[torneo]/[categoria]`, conviviendo con el bracket.
- El orquestador deja de omitir round-robin para Academia.

**Fuera de alcance**

- Cross-link a `/[slug]`, consolaciones (post-feature).

**Dependencias:** Fase 1 hecha (el parser y la UI se montan sobre el modelo y las rutas existentes).

**Criterios de "hecha"**

- Las categorías SERIE de Academia aparecen como tablas de grupo/posiciones, derivadas correctamente de la matriz espejada (tolerante a typos y a resultados faltantes).
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño.

---

## Post-feature (fuera de este roadmap)

Cada uno sería su propia feature con PRP + roadmap:

- **Cross-link de identidad:** cruzar nombres del cuadro con `Player`/usuarios `/[slug]` (normalización fuzzy por typos; uuids estables en MUR ayudan). Habilita "ver el cuadro completo del torneo que jugaste" y enlazar rivales a sus perfiles.
- **Consolaciones** (Copa de Plata/Bronce) vía `bracket_type` de MUR.
- **Alta de fuentes self-service** (admin UI) si el registry en código se queda corto.

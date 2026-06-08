# Research: Cuadros de La Academia MG desde Google Sheets

> **Tipo:** investigación de **factibilidad**. Pregunta que responde: *¿se puede leer la data de la planilla y
> mostrar el cuadro de este torneo en UI?* → **Sí** (ver § 6).
> **Fecha:** 2026-06-08.
> **Procedencia:** se investigó originalmente para una app aparte que nunca arrancó; se migró a Tenis Tracker
> porque la feature se hará acá. Los hallazgos son sobre la planilla real, así que valen igual.
> **Alcance:** SOLO factibilidad y documentación de la fuente. Las decisiones de diseño (esquema, cómo encaja
> con el dominio actual, alcance del MVP, etc.) **no se resuelven acá** — quedan como notas sueltas en § 7 para
> el agente que diseñe la feature.

## 1. Contexto

La Academia MG es un club de tenis que organiza un torneo (varias categorías) y lleva los cuadros en
**una sola planilla pública de Google Sheets**, una hoja (tab) por categoría. La planilla es manual y
"rudimentaria". La idea es **leer esa planilla y mostrar los cuadros en una UI linda**, refrescando cada cierto
tiempo.

El torneo en curso: **"TORNEO DE TENIS LA ACADEMIA MG 2026 — ETAPA 3: JUNIO JULIO 2026"**. Dura ~1 mes y se
actualiza como mucho un par de veces por día.

## 2. Fuente de datos

- **Spreadsheet ID:** `1JpCOXQf9IUobOre6LgqyWjluD6BEdNJ0W9I02lpiWEo`
- **Link compartido (categoría D, ejemplo):**
  `https://docs.google.com/spreadsheets/d/1JpCOXQf9IUobOre6LgqyWjluD6BEdNJ0W9I02lpiWEo/edit?gid=1622965703#gid=1622965703`
- **El workbook es público** (cualquiera con el link puede ver). No requiere OAuth ni API key para leerlo.

### 2.1. Acceso a los datos: export CSV por hoja (confirmado funcionando)

Cada hoja se baja como CSV sin autenticación con el endpoint de export, pasando el `gid` de la hoja:

```
https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/export?format=csv&gid=<GID>
```

Probado con `curl`: responde `HTTP 200`, `text/csv; charset=utf-8`, ~2.5 KB por hoja. Sin headers especiales.
Cada fila del CSV = una fila de la hoja; cada coma = una columna → preserva la **posición (fila, columna)** de
cada celda, que es justo lo que necesita el parser (ver § 4).

**Riesgo:** depende de que la planilla siga siendo pública. Si cambian permisos/sharing o mueven la estructura,
el export puede dejar de funcionar o cambiar de forma.

### 2.2. Descubrimiento de hojas (gids) — dos caminos

El export necesita conocer el `gid` de cada hoja. Dos formas de obtener la lista de categorías:

1. **Scrape de `htmlview` (lo que usé en esta investigación):**
   `…/spreadsheets/d/<ID>/htmlview` devuelve HTML con todos los `gid=<n>` del workbook. Funcional pero
   **frágil** (los nombres de tab vienen por JS, no en el HTML; hay que cruzar con el contenido de cada hoja).
2. **Google Sheets API v4 (`spreadsheets.get`):**
   `GET https://sheets.googleapis.com/v4/spreadsheets/<ID>?fields=sheets.properties(sheetId,title)&key=<API_KEY>`
   Con una **API key gratuita** (sin OAuth, sirve para sheets públicas) devuelve, en JSON limpio, todas las
   hojas con su `sheetId` (= gid) y su `title` (nombre del tab) → permite enumerar categorías sin hardcodear.

> Nota: **no hace falta API key para los datos** (el CSV export alcanza). La API key solo ayudaría a enumerar
> las hojas de forma robusta.

### 2.3. Identificación de la categoría desde el contenido (más confiable que el nombre del tab)

Cada hoja se **autoidentifica** internamente: trae una celda `Categoría:` con el nombre de la categoría. Por
eso, aun sin saber el nombre del tab, se puede etiquetar cada hoja leyendo su contenido (ver § 3.1).

## 3. Inventario de hojas / categorías

El workbook tiene **9 hojas**. Detectadas y clasificadas por su contenido:

| gid          | Categoría (celda interna)   | Formato del cuadro                | Tamaño aprox. |
|--------------|-----------------------------|-----------------------------------|---------------|
| `71645443`   | SINGLES CABALLEROS - A      | **Grupos round-robin (SERIE)**    | chico         |
| `551773797`  | SINGLES CABALLEROS - B      | **Eliminación (bracket)**         | chico         |
| `2022974784` | SINGLES CABALLEROS - C      | **Eliminación (bracket)**         | ~48 jugadores |
| `1622965703` | SINGLES CABALLEROS - D      | **Eliminación (bracket)**         | ~64 jugadores |
| `707073770`  | SINGLES CABALLEROS - E      | **Eliminación (bracket)**         | ~32 jugadores |
| `1523940539` | SINGLES DAMAS               | **Grupos round-robin (SERIE)**    | chico         |
| `243491982`  | DOBLES CABALLEROS           | **Eliminación (bracket)**         | chico         |
| `262342200`  | DOBLES MIXTOS               | **Grupos round-robin (SERIE)**    | chico         |
| `546875922`  | DOBLES DAMAS                | **Grupos round-robin (SERIE)**    | chico         |

> Los gids son del torneo actual; conviene re-descubrirlos (§ 2.2) en vez de asumirlos fijos entre etapas.

### 3.1. Metadatos comunes (mismas filas en todas las hojas)

Las primeras filas de cada hoja tienen un encabezado fijo (índices base 0):

| Fila | Contenido                                                                                  |
|------|---------------------------------------------------------------------------------------------|
| 0    | `TORNEO DE TENIS LA ACADEMIA MG 2026`                                                        |
| 2    | `ETAPA 3: JUNIO JULIO 2026`                                                                  |
| 4    | `Categoría:` , `<NOMBRE DE LA CATEGORÍA>` (col A y B)                                         |
| 6    | `Formato de juego: …` (texto largo; varía: "CON ventaja" vs "sin ventaja", super tie break) |
| 8    | Fila de headers del cuadro (solo en formato eliminación): `Player,Ronda 32,Ronda 16,…`      |

El **formato de juego** (al mejor de 3 sets, con/sin ventaja, súper tie break a 10) está en texto y difiere
entre categorías (ej.: A usa "CON ventaja"; D usa "sin ventaja").

## 4. Hallazgo clave: hay DOS formatos de cuadro

La planilla NO es homogénea. Conviven dos layouts distintos según la categoría → implica **dos parsers y dos
componentes de UI**.

### 4.1. Formato A — Cuadro de eliminación (bracket)

Categorías: **Cab B, C, D, E, Dobles Caballeros.** Es un árbol de eliminación dibujado espacialmente.

**Geometría (verificada en detalle con la categoría D):**

- **Columna 0 (`Player`):** número de siembra/seed (1..N).
- **Columna 1 (header dice `Ronda 32`):** **lista de participantes** (los N jugadores de la primera ronda).
  Cada jugador ocupa **2 filas de alto**; van en filas pares (0, 2, 4, …).
- **Columnas 2..7:** **ganadores de cada ronda + score**. Por cada partido jugado:
  - el **nombre del ganador** se escribe en la columna siguiente, en la **fila del punto medio** entre los
    dos jugadores (fila impar entre ambos),
  - el **score** se escribe en esa misma columna, en la **fila del jugador de abajo** (justo debajo del ganador).

Ejemplo real (categoría D, CSV; `col0,col1,col2,…`):

```
7,P. Verdier,,,,,,        ← fila 12: jugador seed 7 (col1)
,,R. Coore,,,,,           ← fila 13 (punto medio): GANADOR del partido (col2)
8,R. Coore,Wo. ,,,,,      ← fila 14: jugador seed 8 (col1) + SCORE "Wo." (col2)
```

Interpretación: jugaron P. Verdier (7) vs R. Coore (8); ganó R. Coore por walkover.

**Importante sobre los headers de columna:** los rótulos de los organizadores
(`Ronda 32, Ronda 16, Ronda 8, Cuartos, Semi, Final, Campeon`) están **corridos una columna** respecto de la
ronda real. Geométricamente, para un draw de 64:
`col1 = 64 entrantes → col2 = 32 → col3 = 16 → col4 = 8 (cuartos) → col5 = 4 (semi) → col6 = 2 (final) → col7 = 1 (campeón)`.
Conviene **re-etiquetar las rondas por la geometría**, no confiar en los textos de header.

**Algoritmo de parseo (posicional, no por string) — prueba de que es parseable:**
1. Leer `col1` → lista ordenada de entrantes `(seed, nombre, filaBase)`. Los pares de la primera ronda son
   entrantes adyacentes (filas `r` y `r+2`); su punto medio es `r+1`.
2. Para cada ronda `k` (columna `1+k`), por cada par de slots que alimenta, mirar el punto medio: si hay
   nombre → ese partido se jugó; el ganador es ese nombre y el score está en la celda de abajo.
3. **Matchear el ganador a uno de los dos jugadores por POSICIÓN, no por igualdad de string** (hay typos — § 5).
   Guardar igual el string crudo del ganador y del score.
4. El "campeón" cae en la última columna.

### 4.2. Formato B — Grupos round-robin ("SERIE")

Categorías: **Cab A, Singles Damas, Dobles Mixtos, Dobles Damas.** No es árbol: son **grupos (SERIE 1,
SERIE 2, …)**, cada uno una **matriz head-to-head** (todos contra todos).

**Geometría:** dentro de cada SERIE, los jugadores se listan en una columna **y** como encabezados de columna,
formando una grilla. El resultado de cada cruce va en la **celda de intersección** (fila = jugador, columna =
rival).

Ejemplo real (Singles Damas, SERIE 1; CSV):

```
,SERIE 1,,,,
,,V. Lemez,S. Varela,J. Palacios,N. Pose    ← encabezados de columna (rivales)
,V. Lemez,,,,
,S. Varela,,,,6-4 6-1                        ← S. Varela vs N. Pose = 6-4 6-1
,J. Palacios,,,,
,N. Pose,,4-6 1-6,,                          ← N. Pose vs S. Varela = 4-6 1-6 (espejo del anterior)
```

Cada resultado aparece (idealmente) **dos veces, espejado** desde la perspectiva de cada jugador. El parser
construye, por SERIE, la lista de jugadores y la matriz de resultados, y de ahí deriva la **tabla de
posiciones**. **UI distinta:** tablas de grupo / posiciones, no árbol de bracket.

## 5. Irregularidades del parseo (entrada manual)

La planilla es manual; el parser tiene que ser **tolerante a ruido**. Ninguna de estas es bloqueante, pero hay
que contemplarlas:

- **Typos / nombres inconsistentes:** el mismo jugador aparece distinto entre celdas. Ejemplos reales:
  `F. Echevarria` (entrante) vs `F. Echavarria` (ganador) en cat. D; `P. Macchiavello` vs `P. Machiavello` en
  Damas. → Por eso el match ganador↔jugador es **por posición**.
- **Play-ins / arranque irregular del cuadro:** en la cat. D las primeras filas tienen 3 nombres apretados y
  desalineados respecto del patrón de "2 filas por jugador" (mini play-in). La cabecera del cuadro puede no ser
  perfectamente regular.
- **Tokens de resultado no numéricos:** `Wo.` (walkover), `Ret.` / `2-1 Ret.` (retiro), además de scores
  normales (`6-4 5-7 10-5`, super tie break `10-5`). Reconocerlos como resultados válidos.
- **Celdas basura:** aparecen celdas con un `.` suelto al final de la hoja (ruido de edición). Ignorar.
- **Tamaños de draw variables:** 64 / 32 / ~48 (draws con byes) / 16 / 8. Inferir el tamaño de la cantidad de
  entrantes en `col1`; no asumir fijo.
- **Estado parcial:** la mayoría de los partidos aún no se jugaron → la mayoría de las celdas de ganador están
  vacías. "Sin resultado" es el estado normal, no un error.

## 6. Conclusión de factibilidad

- **Se puede. Sin bloqueantes.** La data es accesible sin auth (CSV export, confirmado con `curl`), las
  categorías se descubren (gids) y se autoidentifican (celda `Categoría:`), y el contenido es parseable de forma
  posicional en ambos formatos (bracket y round-robin), incluso con la entrada manual ruidosa.
- **El trabajo real** está en el parseo posicional tolerante a ruido y en la UI (árbol de bracket con
  conectores / tablas de grupos). Nada de eso es un riesgo de viabilidad, es trabajo de implementación.

## 7. Notas para el diseño de la feature (NO decididas acá)

Apuntes sueltos para no perder contexto; los resuelve quien diseñe la feature (PRP), no este doc:

- **Forma natural sobre el stack:** un Vercel Cron (el proyecto ya corre `/api/cron/curation` vía `vercel.json`)
  que baja el CSV por categoría → parser puro en `lib/` → persiste vía service (Prisma/Neon) → la UI (RSC) lee
  de ahí. Servir desde nuestra persistencia (no en vivo contra Google) da resiliencia y habilita historial/diff.
  Guardar el CSV crudo + hash por sync ayuda a diagnosticar y detectar cambios.
- **Solapamiento con el dominio actual:** Tenis Tracker ya tiene `Tournament`, `Category`, `Player`, `Entry`,
  `Match`, pero modelan la *carrera privada* de un usuario (atados a `userId`, "yo vs rival"). El cuadro de la
  planilla es el *draw completo y público*, sin dueño. Definir si va a modelos nuevos o reusa/extiende los
  existentes es una decisión de diseño abierta.
- **Alcance posible del MVP:** arrancar por **eliminación** (Cab B–E + Dobles Cab) = un solo parser + una sola
  UI; dejar round-robin para después.
- **gids:** auto-descubrir (Sheets API key gratis, § 2.2) vs hardcodear los del torneo actual.
- **Identidad de jugadores:** si en algún momento se quiere cruzar los nombres del cuadro con `Player`/usuarios
  de Tenis Tracker (la app ya tiene perfiles públicos `/[slug]` y canonicalización `mergedIntoId`), hace falta
  normalización fuzzy por los typos del § 5.

## Apéndice A — Endpoints útiles

```bash
# Data de una hoja (CSV, sin auth):
curl -sL "https://docs.google.com/spreadsheets/d/1JpCOXQf9IUobOre6LgqyWjluD6BEdNJ0W9I02lpiWEo/export?format=csv&gid=1622965703"

# Enumerar gids (frágil, scrape):
curl -sL "https://docs.google.com/spreadsheets/d/1JpCOXQf9IUobOre6LgqyWjluD6BEdNJ0W9I02lpiWEo/htmlview"

# Enumerar hojas (robusto, requiere API key gratis para sheets públicas):
#   GET https://sheets.googleapis.com/v4/spreadsheets/<ID>?fields=sheets.properties(sheetId,title)&key=<API_KEY>
```

## Apéndice B — Mapa de columnas del formato bracket (categoría D)

| Columna | Header en planilla | Contenido real (geometría)                                  |
|---------|--------------------|-------------------------------------------------------------|
| 0       | `Player`           | Número de seed (1..64)                                       |
| 1       | `Ronda 32`         | **Entrantes** (64 jugadores, 2 filas c/u)                   |
| 2       | `Ronda 16`         | Ganadores ronda 1 (→ 32) + score                            |
| 3       | `Ronda 8`          | Ganadores ronda 2 (→ 16) + score                            |
| 4       | `Cuartos`          | Ganadores ronda 3 (→ 8 = cuartos) + score                  |
| 5       | `Semi`             | Ganadores cuartos (→ 4 = semi) + score                      |
| 6       | `Final`            | Ganadores semi (→ 2 = final) + score                        |
| 7       | `Campeon`          | Campeón                                                      |

> Los headers de la planilla están corridos 1 columna respecto de la ronda real; re-etiquetar por geometría.

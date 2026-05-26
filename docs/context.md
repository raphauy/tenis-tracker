# Lenguaje Ubicuo

Glosario del dominio del proyecto. Es la fuente única para los términos que usamos al hablar (usuario ↔ código). El código está en inglés; este documento usa los términos en español (lo que ve el usuario final) y aclara el nombre en código cuando difiere.

> **No es spec.** Acá solo va lenguaje: qué significa cada término, qué aliases evitar, qué relaciones existen, qué ambigüedades quedaron resueltas. Decisiones de producto van al PRD/PRPs; planes de implementación van a los PRPs.

## Cómo escribir una entrada

Una entrada del glosario tiene este formato:

```
**Término**:
Definición concisa (1-3 oraciones). Aclarar cardinalidad y relaciones con otros términos del glosario.
_Código_: `NombreEnCódigo` (si difiere).
_Evitar_: aliases prohibidos y por qué (opcional).
```

Reglas:

- Una sola definición canónica por concepto. Si hay ambigüedad, resolverla acá antes de codificar.
- Agrupar por temática (sección con `##`) cuando haya 3+ términos relacionados.
- Si un término se refina o cambia, actualizarlo en el lugar — no agregar uno nuevo.
- Al cerrar un término durante `grill-me`, escribirlo acá inline (no al final de la sesión).

## Lenguaje

### Carrera y registro

**Torneo**:
Evento competitivo (ej: "Grados AUT 3a, 5a, 7a", "Torneo La Academia MG 2026"). Tiene nombre, fecha (mes/año, obligatoria — ordena la timeline) y una **Sede**. Puede ofrecer varias **Categorías**, pero el usuario juega una. Vive en el catálogo compartido (curado).
_Código_: `Tournament`.
_Etapa/edición/fecha_: las ediciones recurrentes (ej. "AUT Grados" cada 2 meses) se modelan en el MVP como **Torneos planos distintos**, con la fecha en el nombre ("AUT Grados febrero 2026"). NO hay entidad serie/circuito que las agrupe (post-MVP).

**Categoría**:
Nivel de juego dentro de un torneo. Su vocabulario depende del organizador: Grados AUT usa `2da`–`7ma`; Academia MG usa `A`–`E`. Se modela como etiqueta curada plana (no hay entidad "serie/circuito" en el MVP).
_Código_: `Category`.
_Evitar_: "circuito"/"grado" (así lo llaman algunos clubes) y "rama" (eso es género). NO es el género del cuadro.

**Rama**:
Género del cuadro (Masculino/Femenino). Algunos clubes lo rotulan "Categoría". Fuera del MVP (se asume Masculino).

**Sede**:
Club o lugar donde se juega el torneo (ej: "Los Horneros Raquet Club", "Academia MG"). Catálogo compartido (curado).
_Código_: `Venue`.

**Participación**:
Registro privado del usuario en la dupla (Torneo + Categoría). Agrupa sus **Partidos** de ese cuadro. De acá se deriva el **Resultado del torneo**. Una por (usuario, torneo, categoría).
_Código_: `Entry`.

**Partido**:
Enfrentamiento privado del usuario dentro de una Participación: una **Ronda**, un **rival** (Jugador), un **Resultado** y un estado. El log guarda **solo el recorrido del usuario** (sus partidos), no el cuadro completo ni a los demás jugadores. Solo cuadro principal (sin consolación en el MVP).
_Código_: `Match`.
- _Estados_: `Programado` (rival + ronda, sin marcador) → `Jugado` (con marcador, ganador derivado).
- _Tipos / desenlaces_: `normal`, `walkover` (W.O.), `retiro` (marcador parcial + quién abandonó), `bye` (sin rival ni marcador, pasa de ronda).

**Ronda**:
Etapa del cuadro que el usuario asigna a cada partido. Enum ordenado: `Clasificación < 32avos < 16avos < Octavos < Cuartos < Semifinal < Final`. El orden ordena el recorrido y alimenta la derivación del resultado del torneo.
_Código_: `Round`.

**Jugador**:
Persona del catálogo compartido. En el MVP guarda solo el **nombre**. Cumple el rol de **rival** cuando es el oponente en un Partido.
_Código_: `Player`.
_Evitar_: usar "rival" como entidad — "rival" es el rol, no la entidad.

**Resultado (marcador)**:
Estructurado por sets ordenados: por cada set, games del usuario vs games del rival. Un set puede definirse en tie-break (7-6), guardando el desglose del tie-break. El set decisivo puede ser un **super tie-break** (reemplaza al 3er set); su modo varía por torneo —"a morir a 10" o "a diferencia de 2"— pero la app no lo guarda ni valida la regla. El ganador del partido se deriva contando sets ganados (el super tie-break cuenta como un set; gana quien tiene más en cada uno). Si el usuario gana 2 sets no hay super tie-break.

**Resultado del torneo**:
Estado derivado de la Participación según el último partido + su ronda: `Campeón` (ganó la Final), `Finalista` (perdió la Final), `Semifinalista` y demás "eliminado en {Ronda}", o `En curso` si hay un partido Programado pendiente.

### Multi-tenant y catálogo

**Catálogo compartido**:
Entidades globales reutilizables: **Torneo, Categoría, Sede** (curadas) y **Jugador** (sin gate). Cada entrada tiene `createdBy` y, las curadas, un `status`.
- _Estados (Torneo/Categoría/Sede)_: `pending` (visible y usable **solo por su creador**) → `approved` (disponible para todos). El superadmin aprueba o **fusiona/reasigna** duplicados a la entrada canónica.
- _Jugador_: compartido sin aprobación (creación libre). Dedup con IA queda post-MVP.

**Usuario / Superadmin**:
`Usuario`: registra su carrera privada (Participaciones, Partidos) y crea entradas de catálogo. `Superadmin`: ve y edita todo, y gestiona la cola de curado. Auth por OTP (NextAuth v5). El Superadmin es además un jugador con su propio Perfil (no un rol "solo moderador").

### Identidad y perfil

**Perfil**:
Página pública de un jugador en `/[slug]` que muestra su carrera (Timeline de torneos + Estadísticas). Para terceros es **read-only**; para el dueño trae los controles de carga/edición. Si la **Visibilidad** es privada, un tercero ve una página "perfil privado" (con el nombre, sin el contenido).
_Código_: ruta dinámica raíz `/[slug]` (reemplazó a `/app`).
_Evitar_: usar "perfil" para la página de edición de la cuenta — eso es **Ajustes**.

**Slug**:
Identificador único del jugador en la URL (ej. `raphael-carvalho`). Se elige en el **Onboarding** y queda **fijo** (no editable self-service en el MVP). Formato `[a-z0-9-]`, 3–30 chars, único case-insensitive; no puede ser una palabra **reservada** (rutas de primer nivel como `login`, `admin`, `api`, `ajustes`, etc. + internos de Next).
_Código_: `User.slug`.
_Evitar_: "username", "handle".

**Visibilidad**:
Estado público/privado del Perfil, elegido por el dueño en **Ajustes**. Default **público**. Privado oculta el contenido a terceros (ven "perfil privado"); el dueño siempre ve todo.
_Código_: `User.visibility` (o equivalente).

**Onboarding**:
Paso obligatorio tras el primer login: el usuario elige **nombre** (campo libre) y **Slug** (autosugerido desde el nombre, editable). Sin slug no puede usar la app (el `proxy.ts` lo fuerza). No pide foto ni visibilidad (eso queda para Ajustes).

**Ajustes**:
Página `/[slug]/ajustes` donde el dueño edita su **nombre** y **foto** (avatar) y cambia la **Visibilidad**. El **Slug** se muestra read-only (fijo).
_Evitar_: llamarla "perfil".

### Estadísticas

Siguen las convenciones estándar del tenis (ATP / Tennis Abstract). Todas se derivan del log propio; viven en el **Perfil** (`/[slug]/stats`).

**Récord W/L**:
Victorias–derrotas en **partidos jugados**: solo `normal` y `retiro` (el partido empezó). El **walkover** NO cuenta (ni W ni L: el partido no se jugó); el **bye** y los `scheduled` son invisibles. Un torneo **En curso** aporta sus partidos ya jugados al récord, aunque no sume a los logros.
_Evitar_: contar el walkover o el bye como partido.

**Win%**:
`W / (W + L)` sobre el mismo universo del **Récord W/L** (walkover y bye nunca en el denominador).

**Walkovers (W.O.)**:
Avances sin jugar. Fuera del récord, pero se muestran como nota informativa aparte (ej. "+2 W.O.") para explicar un recorrido con pocos partidos jugados.

**Logros**:
Conteos **acumulativos** ("llegó a", convención ATP): **Títulos** (ganó la final) ≤ **Finales** (llegó a la final, incl. las ganadas) ≤ **Semis** (llegó a semifinal o más). Cada uno incluye al de arriba. Solo torneos con resultado cerrado (no En curso).
_Evitar_: mezclar acumulativo con el desglose excluyente del **Resultado del torneo** (Campeón/Finalista/Semifinalista/Eliminado son baldes mutuamente excluyentes; los Logros NO).

**Mejor resultado** (por año/categoría):
El **Resultado del torneo** más alto del grupo. Orden: Campeón > Finalista > Semifinalista > Eliminado en {ronda, más alta primero} > En curso.

**Head-to-Head (H2H)**:
Récord W/L contra un **rival** recurrente (2+ partidos jugados) dentro del log propio. Mismo criterio que el Récord W/L (walkover fuera). Se ordena por cantidad de enfrentamientos (desc). Limitación: el rival es solo un nombre; dos homónimos se fusionan.
_Evitar_: H2H entre usuarios (post-MVP) — esto es solo contra Jugadores del catálogo.

**Año** (de una stat):
Sale de `tournament.startDate`; si es null, cae al `createdAt` de la Participación (mismo fallback que ordena la timeline).

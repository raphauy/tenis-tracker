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
Evento competitivo (ej: "Grados AUT 3a, 5a, 7a", "Torneo La Academia MG 2026"). Tiene nombre, fechas y una **Sede**. Puede ofrecer varias **Categorías**, pero el usuario juega una. Vive en el catálogo compartido (curado).
_Código_: `Tournament`.

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
Estructurado por sets: por cada set, games del usuario vs games del rival. El 3er set puede ser super tie-break a 10 (sin diferencia de 2). El ganador del partido se deriva.

**Resultado del torneo**:
Estado derivado de la Participación según el último partido + su ronda: `Campeón` (ganó la Final), `Finalista` (perdió la Final), `Semifinalista` y demás "eliminado en {Ronda}", o `En curso` si hay un partido Programado pendiente.

### Multi-tenant y catálogo

**Catálogo compartido**:
Entidades globales reutilizables: **Torneo, Categoría, Sede** (curadas) y **Jugador** (sin gate). Cada entrada tiene `createdBy` y, las curadas, un `status`.
- _Estados (Torneo/Categoría/Sede)_: `pending` (visible y usable **solo por su creador**) → `approved` (disponible para todos). El superadmin aprueba o **fusiona/reasigna** duplicados a la entrada canónica.
- _Jugador_: compartido sin aprobación (creación libre). Dedup con IA queda post-MVP.

**Usuario / Superadmin**:
`Usuario`: registra su carrera privada (Participaciones, Partidos) y crea entradas de catálogo. `Superadmin`: ve y edita todo, y gestiona la cola de curado. Auth por OTP (NextAuth v5).

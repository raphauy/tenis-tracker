# Domain Docs

Cómo los engineering skills consumen la documentación de dominio de este repo.

Este repo es **single-context**: un glosario en `docs/context.md` más `docs/adr/`. No hay
`CONTEXT.md` en la raíz: donde un skill diga `CONTEXT.md`, es `docs/context.md`.

## Antes de explorar, leer

- **`docs/context.md`**: el glosario del lenguaje ubicuo de Tenis Tracker. Es la fuente única de los
  términos que se usan al hablar entre Raphael y el código.
- **`docs/adr/`**: los ADRs que tocan el área donde se va a trabajar.
- **`CLAUDE.md`** y **`AGENTS.md`**: stack, arquitectura por capas, patrones, idioma.

Si algo de esto no existe, **seguir sin comentarlo**. No hace falta avisar que falta ni proponer
crearlo de entrada: `/domain-modeling` lo crea cuando de verdad se resuelve un término o una
decisión.

## El glosario es solo lenguaje

`docs/context.md` define qué significa cada término, qué aliases evitar, qué relaciones hay y qué
ambigüedades quedaron resueltas. **No es spec ni decisión de implementación.** Las decisiones de
producto y de diseño van a la spec; las técnicas difíciles de revertir, a un ADR.

Cuando una sesión cierra un término nuevo o corrige uno, lo escribe en `docs/context.md` ahí mismo,
con el formato del archivo: definición concisa, nombre en código cuando difiere, aliases a evitar,
relaciones.

## Usar el vocabulario del glosario

Cuando la salida nombra un concepto del dominio (título de un issue, propuesta de refactor,
hipótesis, nombre de un test), se usa el término como lo define el glosario, sin derivar a sinónimos
que el glosario descarta. El texto para una persona va con el término en español; cuando nombra
código, el identificador tal cual, sin traducir.

Si el concepto que hace falta no está en el glosario, es una señal: o se está inventando lenguaje
que el proyecto no usa (repensarlo), o hay un hueco real (anotarlo para `/domain-modeling`).

## ADRs

Viven en `docs/adr/`, numerados `NNNN-slug-en-espanol.md`, en español, con el formato de los
existentes: prosa corta con **Contexto**, **Decisión** y **Motivo**. Se escribe un ADR cuando la
decisión explica algo que, sin el documento, parece un bug o un dato huérfano al que lo lea después.
El ADR va en el mismo commit que el código que lo implementa.

## Marcar conflictos con un ADR

Si la salida contradice un ADR existente, decirlo en voz alta en lugar de pisarlo en silencio:

> _Contradice el ADR 0003 (identidad del cuadro externo por contenido), pero vale reabrirlo porque..._

## Las notas de research

`/research` guarda sus hallazgos citados en `docs/research/`.

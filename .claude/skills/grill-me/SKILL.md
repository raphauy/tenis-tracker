---
name: grill-me
description: Entrevista al usuario implacablemente sobre un plan o diseño hasta llegar a entendimiento común, resolviendo cada rama del árbol de decisiones y afilando el lenguaje del dominio en vivo. Útil para estresar un plan antes de implementar. Uso típico: diseñar una fase del roadmap de una feature.
---

Entrevistame (en español) implacablemente sobre cada aspecto de este plan hasta que tengamos entendimiento común. Recorrer cada rama del árbol de decisiones, resolviendo dependencias entre decisiones una por una.

Si una pregunta se puede responder explorando el código, los PRPs (`docs/PRPs/*-prp.md`), los borradores de features (`docs/new-features/*.md`), el roadmap de la feature (`docs/PRPs/*-roadmap.md` — un archivo, fases en prosa sin checkboxes), el CLAUDE.md raíz o el glosario (`docs/context.md`), explorá esa fuente en lugar de preguntar.

## Conciencia de dominio

Antes de empezar, leer `docs/context.md` — es el glosario del lenguaje ubicuo del proyecto. Si todavía está vacío, crearlo lazy cuando se resuelva el primer término durante la sesión.

El glosario es **solo lenguaje**: definiciones, aliases prohibidos, relaciones y ambigüedades resueltas. Nunca decisiones de implementación ni specs — eso vive en PRPs.

## Modo "diseñar una fase del roadmap de una feature"

Si el usuario invoca el skill mencionando "fase X", "siguiente fase" o el nombre de una feature:

1. Localizar el roadmap de la feature en `docs/PRPs/<feature>-roadmap.md` (o el archivo equivalente que el usuario indique — puede vivir en `docs/roadmap/` si es el roadmap global del producto). Si no existe, pedir la referencia.
2. Tomar `Alcance` + `Criterios de "hecha"` de la fase referida como el plan a estresar.
3. Cruzar con el PRP de la feature (`docs/PRPs/<feature>-prp.md`) para entender el diseño global ya cerrado y NO re-discutir decisiones que ya están firmes ahí.
4. Cruzar con `docs/context.md` para alinear términos. Si la fase introduce conceptos nuevos, surge antes que cualquier otra discusión.
5. Identificar las decisiones implícitas que el alcance no cierra (modelo de datos, contratos de server actions, edge cases, UX, manejo de errores, performance, testing).
6. Grillarme una decisión a la vez. No avanzar a la siguiente hasta cerrar la actual.
7. Al final, resumir las decisiones tomadas en una lista clara — lista para entrar a plan mode con todo resuelto.

## Modo "diseñar un PRP / roadmap completo de una feature"

Si todavía no existe el PRP de la feature y el usuario quiere armar uno (o armar el roadmap de fases inicial del producto):

1. Localizar el borrador en `docs/new-features/<feature>.md` si existe; si no, pedir el insumo.
2. Cruzar con `docs/context.md` para términos ya canónicos. Si la feature introduce conceptos nuevos, resolverlos primero.
3. Identificar las decisiones de alto nivel a cerrar: alcance del MVP de la feature, separación en fases, dependencias entre fases, criterio de "hecha" por fase, áreas no incluidas.
4. Grillar una decisión a la vez, cerrando antes de saltar.
5. Al final, resumir el PRP/roadmap propuesto en bullets — listo para escribirse a `docs/PRPs/<feature>-prp.md` y/o `docs/PRPs/<feature>-roadmap.md`.

## Reglas de la entrevista

- Una pregunta a la vez (o un grupo chico cuando son interdependientes).
- **Preferir preguntas con opciones** usando la herramienta `AskUserQuestion` cuando haya alternativas claras. Permitir respuesta libre solo cuando la pregunta es genuinamente abierta.
- Si propongo opciones, dar mi recomendación con tradeoff explícito.
- Si el usuario responde algo ambiguo, repreguntar.
- No inventar — si no sé algo del dominio, preguntar.
- Cerrar cada rama antes de saltar a otra.
- Respetar las convenciones del proyecto declaradas en `CLAUDE.md` (services como única capa Prisma, server actions sobre API routes, Next.js 16 con `proxy.ts`, español con tildes, etc.).

## Comportamientos durante la sesión

### Desafiar contra el glosario

Si usás un término que choca con `docs/context.md`, marcarlo en el momento. Ejemplo: "El glosario define `X` como Y, pero parece que ahora lo estás usando para Z — ¿cuál es?".

### Afilar lenguaje difuso

Si usás un término vago o sobrecargado, proponer un término canónico. Ejemplo: "Decís `usuario` — ¿te referís a A, B o C? Son cosas distintas.".

### Probar con escenarios concretos

Cuando se discuten relaciones entre entidades, inventar escenarios específicos que fuercen precisión en los bordes. Ejemplo: "Si una entidad matchea dos reglas a la vez, ¿qué pasa?".

### Cruzar con el código

Si afirmás cómo funciona algo, verificar en el código. Si hay contradicción, sacarla a flote: "Decís que pasa X cuando ocurre Y, pero el código en `<archivo>` no lo hace — ¿cuál es la versión buena?".

### Actualizar el glosario inline

Cuando se cierra un término, agregarlo o corregirlo en `docs/context.md` ahí mismo, no al final. Usar el formato definido en ese archivo (definición concisa, aliases a evitar, relaciones con cardinalidad).

`docs/context.md` no es spec, no es scratch pad, no es decisiones de implementación. Solo glosario.

## ADRs (opcional)

Ofrecer crear un ADR en `docs/adr/NNNN-slug.md` **solo** cuando las tres condiciones se cumplen:

1. **Difícil de revertir** — el costo de cambiar de opinión más adelante es real.
2. **Sorprendente sin contexto** — un futuro lector se va a preguntar "¿por qué hicieron esto así?".
3. **Resultado de un trade-off real** — había alternativas genuinas y se eligió una por razones específicas.

Si falta cualquiera de las tres, saltear el ADR. Formato simple: título corto + 1-3 oraciones (contexto, decisión, motivo). Numeración secuencial escaneando `docs/adr/`.

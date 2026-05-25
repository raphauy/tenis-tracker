# PRPs — Product Requirement Prompts

Cada **feature** tiene aquí dos archivos (el MVP inicial se trata como una feature más):

- `<feature>-prp.md` — diseño completo de la feature: goal, why, what + success criteria, **decisiones cerradas** (tabla, no re-discutir), contexto necesario (archivos a leer, gotchas), **implementation blueprint** (data models + task list granular + pseudocódigo de los puntos clave), validation loop, final checklist y anti-patterns.
- `<feature>-roadmap.md` — desglose en **fases secuenciales**, cada una con `Estado`, `Objetivo`, `Alcance`, `Fuera de alcance`, `Dependencias` y `Criterios de "hecha"`.

Convención de nombre: `kebab-case`, sin prefijo numérico. Ejemplo: `auth-otp-prp.md`, `auth-otp-roadmap.md`.

## Reglas del roadmap

- **Sin checkboxes de tareas ni numeración `X.Y.Z`.** El detalle granular vive en el PRP (task list); el roadmap es prosa por fase. El plan ejecutable de cada fase se arma en su momento con `/grill-me` + plan mode.
- Una fase = un chunk shippable. **Lo bastante grande** para no perder tiempo en micro-fases; **no tanto** como para perder detalle por exceso de contexto. Si una feature es chica, puede ser una sola fase.
- El **schema Prisma de la feature se migra completo en la primera fase** (de una sola vez), así las fases siguientes no arrastran migraciones.
- Estado de cada fase: `pendiente` · `en curso` · `hecha` (validada por el usuario).

## Flujo típico

1. (Opcional) Borrador de la feature en `docs/new-features/<feature>.md`, o diseño directo vía `/grill-me`.
2. Diseñar el PRP completo (`<feature>-prp.md`) y derivar el roadmap (`<feature>-roadmap.md`).
3. Por cada fase: `/grill-me` para cerrar decisiones de implementación → plan mode → implementar → validar con el usuario antes de la siguiente.

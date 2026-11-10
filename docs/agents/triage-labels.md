# Triage Labels

Los skills hablan de cinco roles canónicos de triage. Este archivo los mapea a las labels reales del
tracker de este repo. Los nombres de las labels van en inglés, aunque el contenido de los issues
esté en español.

| Label en mattpocock/skills | Label en nuestro tracker | Significado |
| -------------------------- | ------------------------ | ----------- |
| `needs-triage`             | `needs-triage`           | Hay que evaluar el issue |
| `needs-info`               | `needs-info`             | Esperando información de quien lo reportó |
| `ready-for-agent`          | `ready-for-agent`        | Especificado del todo, listo para una sesión AFK |
| `ready-for-human`          | `ready-for-human`        | Necesita que lo haga una persona |
| `wontfix`                  | `wontfix`                | No se va a hacer |

Cuando un skill nombra un rol ("aplicá la label de listo para agente"), se usa la label de la
columna del medio.

## Labels de wayfinder

`/wayfinder` usa su propio namespace, también creado en este repo:

| Label | Significado |
| ----- | ----------- |
| `wayfinder:map`       | El issue mapa, con el destino y las decisiones |
| `wayfinder:research`  | Ticket hijo que resuelve una sesión de research AFK |
| `wayfinder:grilling`  | Ticket hijo que resuelve una conversación con Raphael |
| `wayfinder:prototype` | Ticket hijo que se resuelve construyendo un prototipo descartable |
| `wayfinder:task`      | Ticket hijo que es trabajo manual, no una decisión |

## Labels de modelo

Todo issue lleva el modelo sugerido para la sesión que lo va a tomar (ver
`docs/agents/issue-tracker.md` § Label de modelo sugerido):

| Label | Significado |
| ----- | ----------- |
| `model:fable` | Diseño y decisiones caras de equivocar: Fable |
| `model:opus`  | Ejecución, el camino ya está marcado: Opus |

## Labels de área

Todavía no hay. Si más adelante conviene filtrar por módulo (cuadros, notificaciones, WhatsApp,
perfil), se agregan acá y se crean con `gh label create`.

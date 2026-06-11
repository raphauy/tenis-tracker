# Roadmap — Notificaciones de resultados

Plan por fases secuenciales. PRP completo en [`notificaciones-prp.md`](./notificaciones-prp.md). Lenguaje en [`../context.md`](../context.md) § "Notificaciones de resultados". Depende de las features **cuadros** y **whatsapp-kapso** (ambas con MVP deployado).

## Cómo usar este documento

1. Al abrir sesión de implementación, leer este doc + el PRP + el glosario.
2. Buscar la **primera fase `pendiente`** con dependencias en `hecha`.
3. `/grill-me` + plan mode usando `Alcance` + `Criterios de "hecha"` de la fase. Cruzar con el PRP (no re-discutir "Decisiones cerradas").
4. NO avanzar de fase sin confirmación del usuario.

## Estados

- `pendiente` — no comenzada
- `en curso` — en desarrollo activo
- `hecha` — validada por el usuario, mergeada y deployada

---

## Fase 1 — Notificaciones por email + WhatsApp (única fase)

- **Estado:** en curso — código completo (typecheck/build/tests OK); falta aprobar los 4 templates en Meta y el E2E en uso real.
- **Objetivo:** que el dueño de un Favorito reciba un aviso cuando ese nombre registra un resultado nuevo en un cuadro externo, por **email** y/o **WhatsApp**, con configuración fina (canal, modo, y on/off por favorito y por canal) y defaults inteligentes. Esta fase **migra el schema completo de la feature** de una sola vez.

> El usuario eligió **una sola fase** (email + WhatsApp juntos), no email-primero. El bloqueante externo es la **aprobación de Meta** de los 4 templates UTILITY.

**Alcance**

- **Schema completo** (migración única): `EmailNotifyMode` / `WhatsappNotifyMode` / `NotifyOutcome` / `NotifyChannelStatus`; preferencias en `User` (defaults frozen: phone-first → WhatsApp inmediato); toggles `notifyEmail` / `notifyWhatsapp` en `FavoritePlayer`; modelo `ResultNotification` (bandeja de salida con dedup). Backfill de users existentes con email verificado → resumen diario. Ver PRP § Data Models.
- **Motor de detección** enganchado en `syncExternalBrackets`: leer el cuadro viejo antes de pisarlo, **diff** old↔new por transición `pending→played` (baseline si es la primera vez), cruzar nombres ganador/perdedor con `FavoritePlayer` (todos los users), y poblar la bandeja idempotentemente. Diff puro y testeable en `src/lib/cuadros/`.
- **Canales:** `whatsapp-service.sendTemplate` (Kapso, fuera de ventana) + los **4 templates UTILITY** (`won`/`lost` ya creados; `champion`/`finalist` a crear y aprobar). `email-service`: email inmediato + **resumen diario** (React Email, con la línea educativa). Dispatch inmediato en el mismo run del sync; resumen en un **cron diario** a la mañana.
- **Cadencia de sync:** cambiar el cron de cuadros a **cada hora 8am–medianoche UY** (`0 0-3,11-23 * * *` UTC), nada de noche (Neon). Sumar el cron del resumen (`0 11 * * *` UTC).
- **UI:** **página dedicada** `/[slug]/notificaciones` (solo dueño): modos globales por canal + lista de favoritos con toggles por canal. Links desde Ajustes y `/cuadros`.
- **Aviso post-verificación de email:** al verificar el email, avisar que ya puede recibir por email / resumen diario (sin auto-cambiar preferencias).

**Fuera de alcance**

- Notificaciones de los **partidos propios** del usuario (carrera privada). Resolución de identidad de nombres (homónimos, dobles). Score en la perspectiva del favorito. Tope de gasto de WhatsApp. Configurar por **tipo de desenlace** (ej. "solo victorias"). Quiet hours / más canales (push, etc.).

**Dependencias:** features **cuadros** (sync + `ExternalBracket.data`) y **whatsapp-kapso** (`whatsapp-service`, número conectado) hechas. **Bloqueante:** los 4 templates UTILITY **aprobados** por Meta antes de cerrar la fase.

**Criterios de "hecha"**

- Un favorito notificable con un resultado nuevo en un cuadro → el dueño recibe el aviso una sola vez por sus canales activos, con los datos correctos según el desenlace (ganó/perdió/campeón/finalista).
- Silenciar un favorito por canal: sigue resaltado en `/cuadros`, no llega por ese canal.
- Resumen diario: un email a la mañana con los resultados del día anterior; sin resultados, sin email.
- Defaults correctos (email-si-verificado / WhatsApp-si-no, frozen); al verificar email se avisa sin auto-cambiar.
- New-only: marcar un favorito que ya jugó no dispara avisos viejos; re-sincronizar no duplica.
- Sync corre solo 8am–medianoche UY; resumen a la mañana.
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño en uso real.

---

## Post-feature (fuera de este roadmap)

Cada uno sería su propia feature con PRP + roadmap:

- **Identidad de nombres:** cruzar los nombres del cuadro con `Player`/usuarios (fuzzy) para eliminar homónimos y habilitar dobles → notificaciones más precisas y "ver el perfil del rival".
- **Notificaciones de la carrera propia:** avisar al usuario (o a quienes lo siguen) de sus propios partidos cargados.
- **Más canales / control fino:** push web, quiet hours, configurar por tipo de desenlace, tope de gasto de WhatsApp.
- **Score en la perspectiva del favorito:** normalizar el marcador (flip p1/p2) para mostrarlo siempre desde el lado del jugador seguido.

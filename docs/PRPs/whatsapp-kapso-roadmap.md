# Roadmap — WhatsApp con Kapso (auth + integración)

Plan por fases secuenciales. PRP completo en [`whatsapp-kapso-prp.md`](./whatsapp-kapso-prp.md). Research previa en [`../research/kapso-whatsapp.md`](../research/kapso-whatsapp.md). Lenguaje del dominio en [`../context.md`](../context.md).

## Cómo usar este documento

1. Al abrir sesión de planificación/implementación, leer este doc + el PRP + la research.
2. Buscar la **primera fase `pendiente`** con dependencias en `hecha`.
3. `/grill-me` + plan mode usando `Alcance` + `Criterios de "hecha"` de esa fase. Cruzar con el PRP (no re-discutir "Decisiones cerradas").
4. NO avanzar de fase sin confirmación del usuario.

## Estados

- `pendiente` — no comenzada
- `en curso` — en desarrollo activo
- `hecha` — validada por el usuario, mergeada y deployada

---

## Fase 1 — Integración Kapso + panel de admin (piloto)

- **Estado:** en curso
- **Objetivo:** que la integración con Kapso funcione end-to-end y se pueda probar desde `/admin` **antes** de tocar la auth. Es el piloto: conectar el número, mandar y leer texto, ver salud/estado de la conexión.

> **Revisión post `/grill-me` (2026-05-27):** la fase se redujo fuerte al descubrir que **Kapso ya persiste conversaciones/mensajes, trackea la ventana de 24 h y expone todo por API/SDK** + tiene inbox hosteado. Decisiones que cambian respecto del plan original (ver tabla de Decisiones cerradas del PRP): **no se persiste** (inbox lee de Kapso), **Fase 1 no migra schema**, **el webhook se difiere a Fase 2**, y el panel **no muestra "costos a la vista"** (no hay API de balance; se linkea a la consola de Billing de Kapso). Número piloto: **pre-verified US** (provisión = acción del usuario; sandbox para dev).

**Alcance**

- **`whatsapp-service`** (única capa que toca Kapso, espeja `email-service`): `sendText` vía SDK con gate de ventana (`isWindowOpen` por `lastInboundAt`), `listConversations`, `getThread`, `getNumberStatus` (metadata + health-check REST de plataforma). Env: `KAPSO_API_KEY` (ya existe), `KAPSO_PHONE_NUMBER_ID`, `KAPSO_PROJECT_ID` (opcional, para el link de Billing).
- **Panel `/admin/whatsapp`** (ruta nueva + sub-nav admin Curado | WhatsApp): estado de conexión + health-check (incl. "payment method" de Meta — research §6.1) + link a la consola de Billing de Kapso.
- **Inbox (lectura desde Kapso):** lista de conversaciones (orden por última actividad), vista de hilo y **respuesta de texto solo dentro de la ventana de 24 h** (fuera, deshabilitado con explicación). Sin iniciar conversación en frío (requiere template). No se persiste nada en nuestra DB.

**Fuera de alcance**

- **Schema** (campos de auth en `User`, `OtpToken.channel`, enums) → Fase 2.
- **Webhook de recepción + HMAC** → Fase 2 (recién ahí dispara el OTP).
- Persistir conversaciones/mensajes; iniciar en frío; media.
- Auth por WhatsApp y validación de email (Fase 2). Templates, notificaciones proactivas, aviso del cron por WhatsApp.

**Dependencias:** ninguna (parte del MVP ya deployado).

**Criterios de "hecha"**

- El superadmin entra a `/admin/whatsapp` y ve estado del número + salud (incl. payment method) + link a Billing.
- Desde tu teléfono escribís al número del proyecto → la conversación y el inbound aparecen en el inbox (leídos de Kapso), con la ventana en "abierta".
- Desde el inbox respondés dentro de la ventana y el mensaje llega; fuera de ventana el envío está deshabilitado.
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño.

---

## Fase 2 — Auth por WhatsApp (Magic-link inverso) + email backup opcional

- **Estado:** pendiente
- **Objetivo:** WhatsApp pasa a ser el **único** canal primario de auth, sin templates pagos. El email queda como dato opcional con rol de backup verificado. La identidad del User es el phone del inbound (sin form que lo tipee).

> **Decisiones cerradas en `/grill-me` (2026-05-28)** — ver tabla de "Decisiones cerradas" del PRP y ADR [0002](../adr/0002-magic-link-inverso-whatsapp.md). Cambios fuertes vs versión anterior de este roadmap: (a) **no mandamos OTP por WA** — el código viaja web→user→server (Magic-link inverso); (b) **email opcional**, no obligatorio; (c) **cero migración** de usuarios existentes (sólo seed del owner); (d) form de login = botón WA + link "no puedo usar WhatsApp ahora".

**Alcance**

- **Schema + migración custom:** `User.email` pasa a nullable, `User.phone` nuevo `@unique` NOT NULL, `phoneVerifiedAt` y `emailVerifiedAt` nullable. Nueva tabla `PendingAuth(code, expiresAt, consumedAt, rejectedReason, resolvedPhone, resolvedUserId)`. `OtpToken` intacto. Migración SQL en 4 pasos (add columns nullable → delete users de prueba → seed owner con phone `+59898353507` y ambas verificaciones → ALTER `phone` NOT NULL).
- **Webhook de Kapso:** `src/app/api/webhooks/kapso/route.ts` valida HMAC (`KAPSO_WEBHOOK_SECRET`) + idempotencia por `waMessageId`. Extrae el **Código de sesión** (regex `/login:\s*([A-HJ-NP-Z2-9]{6})/i` + fallback). Matriz: phone nuevo → crea `User` con `phoneVerifiedAt`; phone existente → loguea; code expirado/inválido → setea `rejectedReason` y responde por WA con mensaje genérico (rate limit 3/5min por phone).
- **Endpoint de polling:** `GET /api/auth/wa/status?code=...` devuelve `{ status: 'pending' | 'consumed' | 'rejected', reason?, userId? }`. Rate limit por code.
- **Login flow (Magic-link inverso):** `/login` muestra botón "Continuar con WhatsApp" + link discreto "No puedo usar WhatsApp ahora". Click WA → crea `PendingAuth` → abre `wa.me?text=Tenis Tracker login: <code>` en nueva pestaña → navega a pantalla de espera con polling (backoff 1s → 3s tras 30s → 5s tras 60s, timeout 10min). Match → `signIn('whatsapp', { code })` → `/[slug]` o `/onboarding`.
- **NextAuth:** dos providers Credentials separados: `whatsapp` (autoriza `{ code }`) y `email` (autoriza `{ email, otp }`, exige `emailVerifiedAt != null`).
- **Email backup (puerta secundaria):** el link "No puedo usar WhatsApp ahora" del login despliega input email → OTP por Resend (flujo actual) → `signIn('email', ...)`. Solo funciona si el User tiene `emailVerifiedAt`.
- **Onboarding:** suma campo email **opcional** sin verificación inline al form existente (nombre + slug).
- **Banner de email:** sticky entre header y main en toda vista de owner (`/[slug]/*` viewer==owner y `/admin/*`). Estado vacío → "Agregá un email…"; pendiente → "Verificá tu email…"; verificado → sin banner. Click → dialog inline (input email u OTP). **No tiene X, no se snoozea.**
- **Inbox del admin:** filtra del hilo y del listado los mensajes que matchean `/^Tenis Tracker login:/i` (auth-noise). Resto intacto vs Fase 1.
- **Cron limpieza:** purga `PendingAuth` con `expiresAt < now() - 24h` (sumar al cron existente o nuevo).
- **Dev:** Cloudflare tunnel ya corriendo en `https://dev.bondsquad.ai`. Webhook configurado una vez en Kapso (sandbox dev + URL de prod).

**Fuera de alcance**

- Cualquier bloqueo de funcionalidad por email sin verificar (solo banner persistente).
- Templates de Meta y notificaciones proactivas.
- Cambio del phone self-service (post-MVP; si Raphael o algún usuario cambia de número, manual del admin por ahora).
- Compartir con UI más rica el estado de la sesión pendiente (WA "recibido", "verificando", etc.) — el polling solo distingue pending/consumed/rejected.

**Dependencias:** Fase 1 hecha (`whatsapp-service`, panel admin, inbox).

**Criterios de "hecha"**

- Login nuevo end-to-end: botón "Continuar con WhatsApp" → mensaje desde mi teléfono → web detecta el match por polling y queda logueado; nuevo User aparece con `phoneVerifiedAt`.
- Login recurrente por WA: User existente loguea sin pasar por onboarding, redirige a su `/[slug]`.
- Email backup funciona sólo si el User tiene `emailVerifiedAt`; si no, rechaza con mensaje claro (sin enumeración).
- Owner: el seed crea `+59898353507` con phone y email verificados; sin banner visible.
- User sin email: banner persistente en toda vista de owner; dialog "Agregá email" → input → guarda; banner cambia a "Verificá email" → dialog OTP → setea `emailVerifiedAt` y desaparece.
- Mensajes "Tenis Tracker login: …" no aparecen en el inbox admin (ni hilo ni listado).
- En rechazos por code inválido/expirado, el usuario recibe **un solo** mensaje genérico por WA (rate limit comprobado).
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño en uso real.

---

## Post-feature (fuera de este roadmap)

- Notificaciones proactivas por WhatsApp (aviso del cron de curado, recordatorios) → requieren **templates utility aprobados** por Meta (ciclo de aprobación + costo). Su propia feature.
- Migración de Kapso a OnMind (objetivo real de la research): multi-tenant, embedded signup por cliente, templates por WABA, tracking de ventana en consola. Feature aparte.

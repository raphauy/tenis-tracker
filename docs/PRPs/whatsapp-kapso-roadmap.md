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

## Fase 2 — Auth por WhatsApp + backup email + validación de email

- **Estado:** pendiente
- **Objetivo:** WhatsApp pasa a ser el canal principal de OTP, con email de backup. Teléfono y email obligatorios. Los usuarios viejos quedan migrados. El email termina verificándose sin fricción en el login.

**Alcance**

- **Schema (movido desde Fase 1):** campos de `User` (`phone @unique`, `phoneVerifiedAt`, `emailVerifiedAt`), `OtpToken.channel`, enum `OtpChannel`. Migración. (Sin `Conversation`/`Message`: la conversación vive en Kapso.)
- **Webhook de recepción (movido desde Fase 1):** `src/app/api/webhooks/kapso/route.ts` con validación HMAC (`X-Webhook-Signature`) + idempotencia (`X-Idempotency-Key`). Es lo que detecta el inbound del usuario y dispara el OTP. Requiere túnel HTTPS en dev.
- **Registro:** form con **teléfono + email** (ambos obligatorios) → botón que abre `wa.me` con texto prefijado. El usuario envía → el webhook detecta el inbound → se genera `OtpToken(channel=WHATSAPP)` → `whatsapp-service.sendText` con el OTP (free-form, dentro de ventana, **$0**). Verificar el OTP ⇒ login + `phoneVerifiedAt`.
- **Login recurrente:** misma mecánica **user-initiated** (el usuario re-inicia por `wa.me` cada vez). Nunca template pago.
- **Fallback email manual:** botón "¿no te llegó? enviar por email" → OTP por Resend (`channel=EMAIL`), flujo actual.
- **Migración de usuarios existentes:** `proxy.ts` fuerza a todo `User` sin teléfono verificado a una pantalla obligatoria de alta+verificación de WhatsApp antes de seguir (patrón del onboarding del slug).
- **Correlación inbound ↔ sesión:** resolver el mecanismo (código en el texto prefijado vs. match por teléfono) — pregunta abierta del PRP, se cierra en `grill-me`.
- **Validación diferida de email:** **banner persistente** mientras `emailVerifiedAt == null` en todas las vistas autenticadas (no bloquea el uso); acción "verificar email" que dispara un **OTP por email** (reusa la maquinaria existente) y al ingresarlo setea `emailVerifiedAt` y apaga el banner. El login por email de backup también marca `emailVerifiedAt` si aplica.

**Fuera de alcance**

- Cualquier bloqueo de funcionalidad por email sin verificar (solo banner).
- Templates de Meta y notificaciones proactivas.

**Dependencias:** Fase 1 hecha (necesita webhook + `whatsapp-service` + `Conversation`).

**Criterios de "hecha"**

- Registro nuevo end-to-end: teléfono+email → OTP por WhatsApp → logueado y teléfono verificado.
- Login recurrente por WhatsApp funciona y es gratis (sin templates).
- Con WhatsApp caído (env mal o número inválido), el botón de email loguea igual.
- Un usuario solo-email preexistente es forzado a agregar+verificar WhatsApp al loguear.
- Email sin verificar ⇒ banner en toda la app; verificar por OTP por email lo apaga de forma persistente; el resto de la app funciona normal mientras tanto.
- `pnpm typecheck` y `pnpm build` pasan. Validado por el dueño.

---

## Post-feature (fuera de este roadmap)

- Notificaciones proactivas por WhatsApp (aviso del cron de curado, recordatorios) → requieren **templates utility aprobados** por Meta (ciclo de aprobación + costo). Su propia feature.
- Migración de Kapso a OnMind (objetivo real de la research): multi-tenant, embedded signup por cliente, templates por WABA, tracking de ventana en consola. Feature aparte.

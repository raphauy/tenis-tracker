# PRP: WhatsApp con Kapso (auth + integración)

**Feature doc:** investigación previa en [`docs/research/kapso-whatsapp.md`](../research/kapso-whatsapp.md) (decisión, costos, regla de 24 h, onboarding Meta).
**Glosario:** [`docs/context.md`](../context.md) — los términos nuevos (WhatsApp, OTP, Conversación, ventana de 24 h…) se cierran inline durante `grill-me`.
**Estado:** Listo para derivar fases / `grill-me`.

> Primera feature post-MVP. Es además el **piloto de Kapso** antes de migrar OnMind (ver research §7). Riesgo de negocio bajo: si algo falla, el email sigue logueando.

---

## Goal

Dotar a Tenis Tracker de un número de WhatsApp (vía **Kapso**, capa oficial sobre la Cloud API de Meta) para:

1. **Autenticar por WhatsApp** como canal principal de OTP, con **email de backup** para que nadie quede sin loguearse.
2. Darle al superadmin un **panel de integración** en `/admin`: setup del número, estado/salud de la conexión, costos, y un **inbox** para enviar/recibir texto y probar el ida y vuelta end-to-end.

El número es el **instant-setup US de Kapso** (cero conflicto, plan Free 2k msg/1 número). El OTP se manda **dentro de la ventana de 24 h** que abre el propio usuario al escribirnos primero → free-form, **sin template ni costo**.

## Why

- El OTP por email (Resend) tiene fricción y deliverability variable; WhatsApp es el canal natural del jugador y llega al instante.
- Es el **piloto real de Kapso**: valida onboarding Meta, SDK, webhooks y la mecánica de la ventana de 24 h con riesgo cero antes de comprometer OnMind (research §7, §9).
- Deja un `whatsapp-service` + webhook + persistencia de conversación **reutilizables**.

## What

Tres bloques funcionales:

1. **Integración + admin (piloto):** servicio de envío con el SDK de Kapso, webhook de recepción (HMAC), persistencia de conversaciones, y panel `/admin` con setup del número US, health-check (incl. estado de billing de Meta), costos a la vista y un **inbox multi-usuario** para mandar/leer texto.
2. **Auth por WhatsApp + backup email:** registro y login con OTP por WhatsApp **iniciado por el usuario** (botón `wa.me` con texto prefijado → abre la ventana → respondemos el OTP gratis). **Teléfono y email obligatorios.** Botón manual de fallback "no me llegó → enviar por email" (flujo Resend actual). Usuarios existentes son forzados a agregar+verificar WhatsApp al loguear.
3. **Validación diferida de email:** fuera del flujo de login; banner persistente hasta verificar; verificación por **OTP por email** (reusa la maquinaria existente).

### Success Criteria

- [ ] El superadmin conecta el número US de Kapso desde `/admin` y ve estado de conexión + salud (incl. "payment method" de Meta) + costos del número.
- [ ] Desde el inbox de `/admin` se envía un texto a un número y se recibe la respuesta (webhook HMAC válido, persistida y visible).
- [ ] Registro nuevo: el usuario carga **teléfono + email** (ambos obligatorios), toca el botón que abre WhatsApp con el texto prefijado, lo envía, y recibe el OTP por WhatsApp; al ingresarlo queda logueado y con el **teléfono verificado**.
- [ ] Login recurrente: el usuario re-inicia por `wa.me` (free-form, **$0**) y recibe el OTP; nunca se manda template pago.
- [ ] Si WhatsApp no entrega, el botón "enviar por email" manda el OTP por Resend y el login funciona igual.
- [ ] Un usuario preexistente (solo email) es forzado a agregar y verificar su WhatsApp al primer login post-feature antes de seguir.
- [ ] Email sin verificar ⇒ banner persistente; verificación por OTP por email lo apaga. No bloquea el uso de la app.
- [ ] `pnpm typecheck` y `pnpm build` sin errores.

---

## Decisiones cerradas (no re-discutir)

> **Revisión post `/grill-me` (2026-05-27):** al verificar que **Kapso ya persiste conversaciones/mensajes, trackea la ventana de 24 h y lo expone por API/SDK + inbox hosteado**, la Fase 1 se simplificó. Cambios respecto del plan original (reflejados en las filas de abajo): el inbox **lee de Kapso, no se persiste**; **Fase 1 no migra schema** (los campos de auth van a Fase 2); el **webhook se difiere a Fase 2**; y **no hay "costos a la vista"** (no existe API de balance — el panel linkea a la consola de Billing de Kapso).

| Tema | Decisión |
|---|---|
| **Proveedor** | **Kapso** (BSP/Tech Provider oficial sobre la Cloud API de Meta). SDK TS `@kapso/whatsapp-cloud-api`. NO Evolution. |
| **Número del proyecto** | **Instant-setup US de Kapso** (Kapso provisiona un número US nuevo). Cero conflicto, setup ~2 min. Plan Kapso Free (2k msg/1 número) alcanza para el piloto. |
| **Canal principal de auth** | **WhatsApp**. Email = **backup** para no quedar sin loguearse. |
| **Datos obligatorios** | **Teléfono Y email**, ambos requeridos en el registro. No hay cuentas solo-email a futuro. |
| **OTP por WhatsApp** | **User-initiated siempre** (registro y login recurrente): el usuario escribe primero (botón `wa.me` con texto prefijado), eso abre la ventana de 24 h, y respondemos el OTP **free-form gratis**. **Nunca template pago** para auth. |
| **Fallback email** | **Botón manual** "¿no te llegó? enviar por email" → OTP por Resend (flujo actual). No automático. |
| **Verificación de teléfono** | Implícita: completar el OTP por WhatsApp en el registro **verifica el teléfono**. |
| **Verificación de email** | **Diferida**, fuera del login. Banner persistente hasta verificar. Método: **OTP por email** (reusa la maquinaria existente). No bloquea el uso. |
| **Usuarios existentes (solo email)** | **Forzar WhatsApp al loguear**: pantalla obligatoria de agregar+verificar WhatsApp antes de seguir (patrón onboarding del slug). |
| **Inbox de admin** | **Lee de la API de Kapso, NO se persiste** (`conversations.list` / `messages.listByConversation` vía SDK). Bandeja de conversaciones + hilo + responder texto dentro de la ventana. Kapso es la fuente de verdad. _(Antes: persistir `Conversation`/`Message` — descartado en grill-me.)_ |
| **Recepción (webhook)** | **Fase 2.** API route `src/app/api/webhooks/kapso/route.ts`, valida **firma HMAC** (`X-Webhook-Signature`) + idempotencia (`X-Idempotency-Key`). En Fase 1 no hace falta: el "recibir" se ve leyendo Kapso; el webhook recién es necesario para disparar el OTP. |
| **Aviso del cron por WhatsApp** | **Fuera de alcance.** El digest de curado sigue por email; notificaciones proactivas (template utility) quedan para otra feature. |
| **Schema** | **Fase 1 no migra nada.** Los campos de auth (`User.phone`/`phoneVerifiedAt`/`emailVerifiedAt`, `OtpToken.channel`, enum `OtpChannel`) se migran en **Fase 2**, donde se usan. **Sin** `Conversation`/`Message` ni enums de mensajería (Kapso es la fuente). _(Antes: "migrar completo en Fase 1" — esa decisión asumía modelos propios que ya no existen.)_ |
| **Costos del número** | **No hay API de balance/uso por número.** El panel muestra estado + health-check (incl. payment method) y **linkea a la consola de Billing de Kapso**. _(El "costos a la vista" original no tenía respaldo de API.)_ |

---

## All Needed Context

### Documentation & References

```yaml
- file: docs/research/kapso-whatsapp.md
  why: Decisión, costos, regla de 24h, templates, onboarding Meta, billing. §4 (ventana 24h), §6 (onboarding/instant-setup US), §7 (integración Tenis Tracker).

- file: docs/context.md
  why: Glosario canónico. Cerrar inline los términos nuevos durante grill-me (WhatsApp, OTP, Conversación, ventana de 24h, verificación de email/teléfono).

- file: src/services/email-service.ts
  why: Patrón de "enviar mensaje" a replicar para whatsapp-service (Resend → SDK Kapso).

- file: src/services/auth-service.ts + src/lib/auth.ts + src/app/login/
  why: OTP actual (OtpToken, Credentials provider, Resend). La auth por WhatsApp se monta encima de esta maquinaria, no la reemplaza.

- file: src/app/api/cron/curation/route.ts
  why: Patrón de API route externa (cron). El webhook de Kapso sigue la misma forma + validación HMAC.

- file: src/proxy.ts
  why: Onboarding forzado del slug = patrón a replicar para forzar WhatsApp a usuarios viejos.

- url: https://docs.kapso.ai/docs/whatsapp/typescript-sdk/introduction
  why: SDK de envío (sendText / templates) y config (apiKey, phoneNumberId).

- url: https://docs.kapso.ai/docs/platform/webhooks/overview
  why: Formato del webhook, HMAC, reintentos, idempotencia.

- file: AGENTS.md + node_modules/next/dist/docs/
  why: Next.js 16 tiene breaking changes; leer antes de codear API routes / proxy.
```

### Known Gotchas

```typescript
// CRITICAL: La ventana de 24h es de META, no de Kapso. Free-form business-initiated NO existe.
//           Por eso TODO OTP por WhatsApp lo dispara un inbound del usuario (wa.me). Ver research §4.
// CRITICAL: El OTP por WhatsApp se manda DENTRO de la ventana (gratis). Nunca asumir que podemos
//           iniciar nosotros sin template.
// CRITICAL: Webhook valida firma HMAC + idempotencia por waMessageId (Meta/Kapso reintenta).
// CRITICAL: Solo src/services/* importa @/lib/prisma. El webhook (API route) delega en services.
// CRITICAL: Next.js 16 — src/proxy.ts, NO middleware.ts.
// CRITICAL: Sin try/catch ni clases en services. Actions devuelven ActionResult<T>.
// PATTERN: phone en E.164 (+598...). Es identidad de login junto al email; ambos @unique.
// PATTERN: Completar OTP por WhatsApp ⇒ phoneVerifiedAt. Completar OTP por email ⇒ emailVerifiedAt.
// GOTCHA: el número US de Kapso puede tener costo mensual y/o requerir método de pago en Meta para
//         escalar; el panel de admin debe exponer el health "payment method" (research §6.1).
```

---

## Implementation Blueprint

### Data Models

> **Post grill-me:** `Conversation`/`Message` y los enums de mensajería **se descartaron** (Kapso es la fuente; no persistimos). De abajo **solo sobreviven** los campos de auth de `User` + `OtpToken.channel` + `OtpChannel`, y se migran en **Fase 2** (no en Fase 1). El bloque queda como referencia histórica del diseño original.

Aditivo a `prisma/schema.prisma` (~~migrar completo en la Fase 1~~ → solo auth, en Fase 2):

```prisma
enum OtpChannel       { WHATSAPP  EMAIL }
enum MessageDirection { INBOUND  OUTBOUND }
enum MessageStatus    { PENDING  SENT  DELIVERED  READ  FAILED }

model User {
  // ...campos actuales...
  phone          String?   @unique   // E.164 (+598...); identidad de login junto al email
  phoneVerifiedAt DateTime?           // se setea al completar OTP por WhatsApp
  emailVerifiedAt DateTime?           // verificación diferida (banner) por OTP por email
  conversation   Conversation?        // 1:1 opcional (la conversación del usuario con el número del proyecto)
}

model OtpToken {
  // ...campos actuales...
  channel  OtpChannel  @default(EMAIL)   // por qué canal se emitió (WhatsApp | email)
}

// Conversación entre el número del proyecto y un teléfono (puede o no ser un User registrado).
model Conversation {
  id             String    @id @default(cuid())
  phone          String    @unique          // E.164 del contacto
  userId         String?   @unique           // si el teléfono corresponde a un User
  lastInboundAt  DateTime?                   // último mensaje DEL contacto → base de la ventana de 24h
  lastMessageAt  DateTime?                   // último mensaje en cualquier dirección (orden del inbox)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  user     User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  messages Message[]

  @@index([lastMessageAt])
}

model Message {
  id             String           @id @default(cuid())
  conversationId String
  direction      MessageDirection
  body           String                        // MVP: solo texto
  waMessageId    String?          @unique        // id de Meta/Kapso → idempotencia
  status         MessageStatus    @default(PENDING)
  createdAt      DateTime         @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
}
```

> Config de la integración (apiKey, phoneNumberId del número US, webhook secret, número para `wa.me`) vive en **env**; el estado/salud en vivo sale de la **API de Kapso**, no se persiste salvo lo mínimo. Si hace falta un registro persistente del número conectado se decide en grill-me.

### Task List

```yaml
# Detalle fino de cada fase se cierra con /grill-me + plan mode. Esto es el blueprint global.

Task A: Schema + migración completa (Fase 1)
  - MODIFY: prisma/schema.prisma (campos de User, OtpToken.channel, enums, Conversation, Message)
  - RUN: pnpm db:migrate --name add_whatsapp_kapso

Task B: whatsapp-service + config (Fase 1)
  - whatsapp-service.ts: sendText(phone, body) vía SDK Kapso; helpers de ventana (isWindowOpen).
  - Env: KAPSO_API_KEY, KAPSO_PHONE_NUMBER_ID, KAPSO_WEBHOOK_SECRET, NEXT_PUBLIC_WA_NUMBER (para wa.me).

Task C: Webhook de recepción (Fase 1)
  - src/app/api/webhooks/kapso/route.ts: valida HMAC, idempotencia por waMessageId.
  - Delega en conversation-service: upsert Conversation por phone, persiste Message inbound,
    actualiza lastInboundAt/lastMessageAt. Dispara hooks (ej. OTP de auth en Fase 2).

Task D: Panel de integración + inbox en /admin (Fase 1)
  - Setup: estado de conexión del número US, health-check (incl. payment method de Meta), costos a la vista.
  - Inbox multi-usuario: lista de conversaciones (orden por lastMessageAt) + vista de hilo + enviar texto.
  - Envío solo habilitado si la ventana está abierta (si no, deshabilitar + explicar).

Task E: OTP por WhatsApp user-initiated (Fase 2)
  - Registro: form con teléfono + email (ambos obligatorios) → botón wa.me con texto prefijado.
  - Webhook detecta el inbound de "registro/login" → genera OtpToken(channel=WHATSAPP) → sendText OTP.
  - Verificar OTP ⇒ login + phoneVerifiedAt. Reusar Credentials provider de NextAuth.
  - Login recurrente: misma mecánica user-initiated.

Task F: Fallback email manual (Fase 2)
  - Botón "¿no te llegó? enviar por email" → OTP por Resend (channel=EMAIL), flujo actual.

Task G: Forzar WhatsApp a usuarios existentes (Fase 2)
  - proxy.ts: si User sin phone/phoneVerifiedAt → pantalla obligatoria de alta+verificación (patrón slug).

Task H: Validación diferida de email (Fase 2)
  - Banner persistente mientras emailVerifiedAt == null.
  - Acción "verificar email" → OTP por email → setea emailVerifiedAt. No bloquea la app.
```

### Per-Task Pseudocode (puntos clave)

#### Flujo OTP por WhatsApp (user-initiated)

```
1. Web: usuario carga phone + email; click "Continuar con WhatsApp"
   → abre wa.me/<NEXT_PUBLIC_WA_NUMBER>?text=<texto prefijado + código de correlación>
2. Usuario envía → Meta/Kapso → webhook inbound (HMAC ok)
3. conversation-service: upsert Conversation(phone), persist Message, set lastInboundAt = now
   → ventana de 24h ABIERTA
4. auth: correlacionar inbound con la sesión/registro pendiente; generar OtpToken(channel=WHATSAPP)
   → whatsapp-service.sendText(phone, "Tu código es 123456")   // free-form, gratis
5. Web: usuario ingresa el código → Credentials provider valida → login + phoneVerifiedAt
```

#### Envío desde el inbox / cualquier saliente

```typescript
// Solo permitido dentro de la ventana de 24h (free-form). Fuera de ventana, en el MVP, NO se envía.
async function sendText(phone: string, body: string) {
  const convo = await getOrCreateConversation(phone)
  if (!isWindowOpen(convo.lastInboundAt)) throw new Error('Ventana de 24h cerrada')
  const res = await kapso.messages.sendText({ to: phone, body })   // SDK
  await persistOutbound(convo, body, res.waMessageId)
}
```

---

## Validation Loop

### Level 1 — Tipos
```bash
pnpm run typecheck
```

### Level 2 — Prisma
```bash
pnpm prisma validate
pnpm db:migrate --name add_whatsapp_kapso
```

### Level 3 — Build
```bash
pnpm run build
```

### Level 4 — Manual E2E
- Conectar el número US en `/admin`; health en verde.
- Inbox: mandar texto a tu número personal y recibir respuesta (persistida).
- Registro nuevo con teléfono+email → OTP por WhatsApp → login, teléfono verificado, banner de email visible.
- Cortar WhatsApp (env mal) → botón "enviar por email" loguea igual.
- Usuario solo-email existente → forzado a agregar WhatsApp al loguear.
- Verificar email por OTP → banner desaparece.

---

## Final Checklist

### Arquitectura
- [ ] Solo `services/` importa `@/lib/prisma`; webhook delega en services.
- [ ] `whatsapp-service` espeja el patrón de `email-service` (funciones, sin try/catch).
- [ ] Webhook valida HMAC + idempotencia por `waMessageId`.
- [ ] `proxy.ts` (no `middleware.ts`) fuerza alta de WhatsApp a usuarios sin teléfono verificado.

### Comportamiento
- [ ] OTP por WhatsApp **siempre** dentro de ventana abierta por el usuario; cero templates pagos.
- [ ] Teléfono y email obligatorios; ambos `@unique`.
- [ ] Fallback email **manual** funcional.
- [ ] Banner de email no bloquea la app; OTP por email lo resuelve.
- [ ] Inbox lista y envía solo dentro de ventana.

### Calidad
- [ ] Strings en español con tildes; controles con `src/components/ui/*`; captura en `<form>` + submit.
- [ ] `"use client"` solo con interactividad; Suspense + Skeleton.

---

## Anti-Patterns

- ❌ NO intentar free-form business-initiated ni asumir que Kapso saltea la ventana de 24h.
- ❌ NO mandar templates pagos para el OTP de auth (la mecánica user-initiated lo hace gratis).
- ❌ NO usar Evolution API ni reusar credenciales entre tenants.
- ❌ NO bloquear el uso de la app por email sin verificar (solo banner).
- ❌ NO persistir secretos de Kapso en DB ni exponerlos al cliente (env + server-only).
- ❌ NO meter el aviso del cron por WhatsApp ni notificaciones proactivas (otra feature).

---

## Preguntas abiertas (para grill-me)

- **Correlación inbound ↔ sesión web:** ¿código único en el texto prefijado de `wa.me`, o match por el teléfono tipeado en el form? (impacta UX y seguridad del registro).
- **Costo real del número US de Kapso:** ¿tiene fee mensual? ¿requiere método de pago en Meta desde el día 1 o solo para escalar? Confirmar en el panel de Kapso al conectarlo.
- **Identidad del contacto del inbox sin User:** una `Conversation` puede ser de un teléfono no registrado (tu número personal de prueba) → `userId` null. ¿Mostrar algún rótulo?
- **Expiración/formato del OTP por WhatsApp:** ¿mismo TTL (~10 min) y 6 dígitos que el de email? (asumido sí).
- **Normalización de teléfono:** validación/formato E.164 en el form (¿prefijo país por defecto +598?).

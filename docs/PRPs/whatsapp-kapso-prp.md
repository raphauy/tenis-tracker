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

> **Revisión 1 — post `/grill-me` Fase 1 (2026-05-27):** al verificar que **Kapso ya persiste conversaciones/mensajes, trackea la ventana de 24 h y lo expone por API/SDK + inbox hosteado**, la Fase 1 se simplificó. Cambios reflejados abajo: inbox lee de Kapso (no persiste), Fase 1 no migra schema, webhook se difiere a Fase 2, sin "costos a la vista".
>
> **Revisión 2 — post `/grill-me` Fase 2 (2026-05-28):** se invirtió el modelo de OTP por WhatsApp. La web NO manda nada para autenticar; el OTP es un **Código de sesión** que la web genera, embebe en el `wa.me` y el usuario nos envía a nosotros. Se descartaron `OtpToken.channel`/enum `OtpChannel`. Email pasa a opcional con rol de **Email backup** verificado. Form de login = botón WA + link "no puedo usar WhatsApp ahora". Cero migración de usuarios existentes (se seedea el owner; los pocos de prueba se borran). Mecanismo de aviso al browser = **polling client-side** (research [`docs/research/notify-server-to-client.md`](../research/notify-server-to-client.md) si se documenta; ADR [0002](../adr/0002-magic-link-inverso-whatsapp.md)). Lenguaje en `docs/context.md` § "Auth por WhatsApp".

| Tema | Decisión |
|---|---|
| **Proveedor** | **Kapso** (BSP/Tech Provider oficial sobre la Cloud API de Meta). SDK TS `@kapso/whatsapp-cloud-api`. NO Evolution. |
| **Número del proyecto** | **Instant-setup US de Kapso**. Plan Kapso Free (2k msg/1 número) alcanza para el piloto. |
| **Canal principal de auth** | **WhatsApp** vía **Magic-link inverso** (ADR 0002). Email backup verificado = puerta secundaria opcional. |
| **Modelo de OTP** | **Magic-link inverso**: la web genera un **Código de sesión** (`PendingAuth.code`, 6 chars `[A-HJ-NP-Z2-9]`, TTL 10 min), lo embebe en `wa.me?text=Tenis Tracker login: K7M3B9`. El usuario lo envía → webhook lo matchea. **La web no manda nada para autenticar.** _(Antes: "mandamos el OTP free-form al usuario" — descartado: redundante con el inbound.)_ |
| **Aviso al browser** | **Polling client-side** sobre `/api/auth/wa/status?code=...` con backoff 1s → 3s (tras 30s) → 5s (tras 60s), corte a 10 min. Sin SSE, sin deps. La DB es el estado compartido entre webhook y pestaña (instancias serverless distintas en Fluid Compute). |
| **Form de login** | **Botón grande "Continuar con WhatsApp"** + link discreto "No puedo usar WhatsApp ahora" (oculto; al click abre input email para flujo backup). No se pide phone ni email arriba en el flujo WA. |
| **Datos obligatorios** | **Solo phone**. Email es **opcional** (rol de backup). _(Antes: ambos obligatorios — descartado.)_ |
| **Verificación de teléfono** | Implícita: el primer inbound exitoso del usuario setea `User.phoneVerifiedAt`. El phone verificado es **siempre el del inbound**, nunca uno tipeado. |
| **Verificación de email** | Diferida y opcional, fuera del login. **Banner de email** persistente hasta que `emailVerifiedAt != null`. Método: **OTP por email** (reusa la maquinaria actual con Resend) desde dialog inline del banner o desde Ajustes. |
| **Email backup (login fallback)** | El flujo email (input email → OTP por Resend → tipear → loguear) funciona solo si `User.emailVerifiedAt != null`. Sin email verificado, no hay puerta de backup. |
| **Onboarding** | Una sola pantalla: nombre + slug (existentes) + **email opcional** (sin verificar inline). Banner aparece desde el día 1 si el email queda vacío o sin verificar. |
| **Matriz del webhook** | Phone del inbound **no existe en DB** → crear `User(phone, phoneVerifiedAt=now)`, loguear (→ onboarding). Phone **existe** → loguear como ese User. Code **expirado/inválido/consumido** → setear `rejectedReason` + responder al usuario por WA con mensaje genérico. (Conflictos email/phone no aplican: el flujo WA no tipea email.) |
| **Feedback por WhatsApp** | **Éxito = ack** ("✅ ¡Listo! Volvé a Tenis Tracker."), **Rechazo = mensaje genérico** ("❌ No pudimos verificar tu código. Pedí uno nuevo desde Tenis Tracker.") con rate limit 3 / 5 min por phone. _(El éxito originalmente era silencio — revertido tras UX testing 2026-05-28: el usuario está en WhatsApp y sin ack no sabe que tiene que volver al browser/app.)_ |
| **NextAuth Credentials** | **Dos providers separados**: `whatsapp` (autoriza `{ code }`) y `email` (autoriza `{ email, otp }`, exige `emailVerifiedAt != null`). |
| **Migración de usuarios existentes** | Cero código de migración. **Seed del owner** con `phone='+59898353507'`, `phoneVerifiedAt=now()`, `emailVerifiedAt=now()`. El resto (usuarios de prueba) se borra en la migración. |
| **Schema** | `User.email` pasa de NOT NULL a **nullable** `@unique`. Nuevo `User.phone` `@unique` **NOT NULL** + `phoneVerifiedAt DateTime?` + `emailVerifiedAt DateTime?`. Tabla nueva `PendingAuth(code, expiresAt, consumedAt, rejectedReason, resolvedPhone, resolvedUserId, createdAt)`. **`OtpToken` sin cambios** (solo flujo email). Migración custom (4 pasos: add columns nullable → delete users de prueba → seed owner → ALTER phone NOT NULL). |
| **Inbox de admin** | Lee de Kapso (sin cambios vs Fase 1). **Filtra del hilo y del listado** los mensajes que matchean `/^Tenis Tracker login:/i` (auth noise). |
| **Recepción (webhook)** | API route `src/app/api/webhooks/kapso/route.ts`. Valida HMAC (`X-Webhook-Signature` con `KAPSO_WEBHOOK_SECRET`) + idempotencia por `waMessageId`. Regex principal `/login:\s*([A-HJ-NP-Z2-9]{6})/i`, fallback `/\b[A-HJ-NP-Z2-9]{6}\b/`. |
| **Dev** | **Cloudflare tunnel** ya corriendo en `https://dev.bondsquad.ai`. Webhook configurado una vez en Kapso (sandbox dev + URL de prod). |
| **Aviso del cron por WhatsApp** | Fuera de alcance. Sigue por email; notificaciones proactivas (template utility) son otra feature. |

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

Cambios sobre `prisma/schema.prisma` para Fase 2 (migración custom, ver § Task List):

```prisma
model User {
  // ...campos actuales...
  email           String?   @unique   // ⚠️ NOT NULL → nullable (email opcional)
  emailVerifiedAt DateTime?            // setea al verificar email (OTP por Resend)
  phone           String    @unique   // ⚠️ NUEVO, NOT NULL — identidad primaria de auth
  phoneVerifiedAt DateTime?            // setea al primer inbound exitoso (Magic-link inverso)
}

// Código de sesión del Magic-link inverso. Una row por intento de login WA.
model PendingAuth {
  id             String    @id @default(cuid())
  code           String    @unique     // 6 chars del charset [A-HJ-NP-Z2-9]
  expiresAt      DateTime               // ~10 min desde createdAt
  consumedAt     DateTime?              // set al primer match exitoso del webhook
  rejectedReason String?                // 'CODE_EXPIRED' | 'CODE_INVALID' | ...
  resolvedPhone  String?                // E.164 del inbound matcheado (auditoría)
  resolvedUserId String?                // user logueado/creado tras match exitoso
  createdAt      DateTime  @default(now())

  @@index([expiresAt])
}

// OtpToken: SIN cambios. Sigue siendo solo para el flujo Email backup + verificación de email.
// No se agrega `channel` ni enum OtpChannel: el flujo WA usa PendingAuth, no OtpToken.
```

Config (api key, phoneNumberId, webhook secret, número del proyecto para `wa.me`) vive en **env** (`KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET`, `NEXT_PUBLIC_WA_NUMBER` para construir links `wa.me` sin filtrar el secret).

### Task List

```yaml
# Detalle fino de cada fase se cierra con /grill-me + plan mode. Esto es el blueprint global.

# ===== Fase 1 (hecha) =====
Task A1: whatsapp-service base + panel admin + inbox (Fase 1, hecha)
  - Cubierto en src/services/whatsapp-service.ts y src/app/admin/whatsapp/*.

# ===== Fase 2 =====
Task B1: Schema + migración custom
  - MODIFY: prisma/schema.prisma (User.email nullable, User.phone NOT NULL,
            phoneVerifiedAt, emailVerifiedAt, model PendingAuth).
  - WRITE: migration.sql en 4 pasos:
      1) ALTER User ADD COLUMN phone/phoneVerifiedAt/emailVerifiedAt nullable;
         ALTER email DROP NOT NULL.
      2) DELETE FROM User WHERE email != 'rapha.uy@rapha.uy';
      3) UPDATE User SET phone='+59898353507', phoneVerifiedAt=now(),
         emailVerifiedAt=now() WHERE email='rapha.uy@rapha.uy';
      4) ALTER User ALTER COLUMN phone SET NOT NULL.
     Crear tabla PendingAuth.
  - RUN: pnpm db:migrate --name auth_whatsapp_phase2.
  - SEED: actualizar prisma/seed.ts para incluir phone del superadmin.

Task B2: Servicio + actions de PendingAuth
  - src/services/pending-auth-service.ts: createPendingAuth(), getByCode(),
    consume(code, phone, userId), reject(code, reason), expireSweep().
  - src/lib/validations/auth.ts: schema del code (regex [A-HJ-NP-Z2-9]{6}).

Task B3: Webhook de Kapso
  - src/app/api/webhooks/kapso/route.ts: valida HMAC (KAPSO_WEBHOOK_SECRET) +
    idempotencia por waMessageId.
  - Extrae code con regex principal y fallback.
  - Resuelve match: phone del inbound → consume PendingAuth → upsert User
    (crea con phoneVerifiedAt si phone nuevo; loguea si phone ya existe).
  - En rechazo: setea rejectedReason + responde por WA con mensaje genérico
    (rate limit 3/5min por phone, vía PendingAuth.resolvedPhone histórico
    o counter en memoria/DB).

Task B4: Endpoint de polling
  - src/app/api/auth/wa/status/route.ts: GET ?code=... → 200 con
    { status: 'pending' | 'consumed' | 'rejected', reason?, userId? }.
  - Ratelimit por code (max ~120 req/10min, alineado al TTL).

Task B5: NextAuth — dos providers Credentials
  - src/lib/auth.ts: agregar provider `whatsapp` (authorize({ code }) → busca
    PendingAuth, valida consumedAt && !rejectedReason, retorna User).
  - Mantener provider `email` (renombrar credentials a {email, otp}) + restringir
    autorización a Users con emailVerifiedAt != null.

Task B6: Form de login renovado
  - src/app/login/login-form.tsx: botón grande "Continuar con WhatsApp" +
    link "No puedo usar WhatsApp ahora" (toggle a input email + flujo OTP actual).
  - Click WA: requestWaLoginAction() crea PendingAuth y devuelve { code, waUrl }.
    Abrir waUrl en nueva pestaña + navegar a /login/esperando-whatsapp?code=...
  - Pantalla de espera: polling con useEffect (backoff 1s→3s→5s, timeout 10min),
    detecta consumed → signIn('whatsapp', {code}), rejected → mensaje + volver
    al login.

Task B7: Onboarding + email opcional
  - src/app/onboarding/*: agregar campo email opcional al form existente.
  - Schema de onboarding (Zod): email opcional, valida formato si está presente.
  - Sin verificación inline; sólo guarda User.email.

Task B8: Banner email + dialog inline
  - Nuevo src/components/profile/email-banner.tsx: sticky entre header y main,
    visible si viewer === owner && (email == null || emailVerifiedAt == null).
  - Click → dialog con dos estados: (a) input email → requestEmailVerifyAction
    (crea OtpToken, manda por Resend), (b) input OTP → verifyEmailAction
    (valida OTP, setea emailVerifiedAt).
  - Render: en layout de /[slug]/* (con guard de owner) y en layout de /admin/*.

Task B9: Inbox del admin — filtrar auth-noise
  - src/services/whatsapp-service.ts: listConversations() y getThread() esconden
    mensajes que matchean /^Tenis Tracker login:/i. Si una conversación queda
    sin mensajes visibles, se omite del listado.

Task B10: Cron cleanup PendingAuth
  - src/app/api/cron/curation/route.ts (o cron nuevo): purga PendingAuth con
    expiresAt < now() - 24h. Cero impacto si no hay cleanup pero higiénico.

Task B11: Configuración webhook + env
  - Documentar setup en Kapso: URL del webhook = https://dev.bondsquad.ai/api/webhooks/kapso
    (dev) + https://<prod>/api/webhooks/kapso. Secreto en KAPSO_WEBHOOK_SECRET.
  - Validar headers HMAC con la referencia .agents/skills/integrate-whatsapp/references/webhooks-reference.md
```

### Per-Task Pseudocode (puntos clave)

#### Flujo Magic-link inverso (login y registro son el mismo flujo)

```
1. Web: usuario click "Continuar con WhatsApp"
   → requestWaLoginAction() crea PendingAuth(code='K7M3B9', expires=+10min)
   → web navega a /login/esperando-whatsapp?code=K7M3B9
   → abre nueva pestaña wa.me/<NEXT_PUBLIC_WA_NUMBER>?text=Tenis Tracker login: K7M3B9

2. Usuario envía el mensaje desde su WhatsApp
   → Meta → Kapso → POST /api/webhooks/kapso (HMAC válido, waMessageId no visto)

3. Webhook:
   - extrae code con regex /login:\s*([A-HJ-NP-Z2-9]{6})/i
   - busca PendingAuth(code), valida no expirado/no consumido
   - phone = inbound.phoneNumber (E.164)
   - upsert User por phone:
       - User no existe → crear User(phone, phoneVerifiedAt=now)
       - User existe → tomar ese User
   - marca PendingAuth.consumedAt=now, resolvedPhone=phone, resolvedUserId=user.id
   - si code expirado/inválido → setea rejectedReason + envía respuesta WA genérica (rate-limited)

4. Web (polling /api/auth/wa/status?code=K7M3B9 con backoff 1s→3s→5s):
   - detecta status='consumed' → signIn('whatsapp', { code }) → redirige a /[slug] (o /onboarding si User nuevo).
   - detecta status='rejected' → muestra mensaje + botón "Volver al login".
   - timeout 10min → muestra "Expiró, probá de nuevo".
```

#### NextAuth Credentials — provider `whatsapp`

```typescript
Credentials({
  id: 'whatsapp',
  credentials: { code: { label: 'Código', type: 'text' } },
  authorize: async (creds) => {
    const code = creds?.code as string
    const pending = await getPendingAuthByCode(code)
    if (!pending?.consumedAt || pending.rejectedReason) return null
    if (!pending.resolvedUserId) return null
    const user = await getUserById(pending.resolvedUserId)
    if (!user || !user.isActive) return null
    return { id: user.id, email: user.email, name: user.name, role: user.role }
  },
})
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
- [ ] Login WA siempre user-initiated (la web no manda nada para autenticar); cero templates pagos.
- [ ] `User.phone` obligatorio y `@unique`; `User.email` opcional y `@unique`.
- [ ] Email backup funcional sólo si `emailVerifiedAt != null`; sin verificar no es puerta.
- [ ] Banner de email no bloquea la app; dialog inline resuelve agregar y verificar.
- [ ] Inbox lista y envía solo dentro de ventana; filtra mensajes de auth (`/^Tenis Tracker login:/i`).
- [ ] Rate limit del feedback WA en rechazos (max 3 / 5 min por phone).

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

## Preguntas resueltas (grill-me Fase 2, 2026-05-28)

- ✅ **Correlación inbound ↔ sesión web:** Código de sesión en el texto prefijado del `wa.me` (`PendingAuth.code`).
- ✅ **Phone verificado:** siempre el del inbound, nunca uno tipeado. Form de login no pide phone.
- ✅ **OTP por WhatsApp:** ya no se manda. El "OTP" viaja web→user→server vía Magic-link inverso. Cero saliente nuestro en éxito.
- ✅ **Aviso al browser:** polling client-side sobre `PendingAuth` (sin SSE; investigado).
- ✅ **Expiración/formato del código:** 6 chars `[A-HJ-NP-Z2-9]`, TTL 10 min, single-use, idempotente por waMessageId.
- ✅ **Identidad del contacto del inbox:** ya resuelta en Fase 1 (`contactName` de Kapso); auth-noise se filtra del listado y del hilo.
- ✅ **Normalización de teléfono:** el phone viene del inbound de Kapso en E.164, lo guardamos tal cual. No hay form que lo pida.

## Preguntas abiertas remanentes (no bloqueantes)

- **Costo real del número US de Kapso:** confirmar en el panel al conectarlo (puede tener fee mensual o requerir método de pago en Meta para escalar).

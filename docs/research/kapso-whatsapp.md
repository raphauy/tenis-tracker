# Investigación: Kapso para integración de WhatsApp

> Documento ejecutivo de decisión. Evalúa **Kapso** (https://kapso.ai · [docs](https://docs.kapso.ai/docs/introduction))
> como reemplazo del actual stack de WhatsApp basado en Evolution API, primero como prueba en
> **Tenis Tracker** (caso simple) y luego —el objetivo real— en **OnMind** (multi-tenant).
> Fecha: 2026-05-27.

---

## TL;DR

- **Kapso es una capa oficial sobre la WhatsApp Cloud API de Meta** (no es no-oficial tipo Evolution/Baileys). Abstrae lo más doloroso: crear la app de Meta, el WABA, los webhooks crudos y el onboarding del cliente vía *embedded signup* de Meta. Tiene SDK TypeScript open-source, multi-tenancy por cliente y webhooks normalizados. Encaja bien con Next.js.
- **Servicio real y activo, pero joven (2024–2025) y con poca comunidad.** Reputación positiva pero basada en poco volumen público. Conviene un piloto chico antes de comprometer OnMind.
- **El punto crítico no es Kapso: es Meta.** Al pasar a la API oficial heredamos la **ventana de 24 h** y la obligación de usar **templates aprobados** para iniciar o reabrir conversaciones. **Ningún proveedor oficial —ni Kapso por ser Meta Business Partner— puede saltarse esto.** Evolution lo ignora hoy (a costa del riesgo de ban del número).
- **Costo:** crear/editar templates es gratis; **enviar cada template entregado se paga** (según categoría + país); el free-form dentro de la ventana de 24 h es gratis. Con Evolution todo era "gratis" → es una variable de negocio nueva para OnMind.
- **Onboarding del cliente:** casi todo ocurre dentro del popup de embedded signup. **No hay que pedirle al cliente que configure el Business Manager a mano.** Único requisito duro: una cuenta de Facebook + decidir el número.

---

## 1. Qué es Kapso y qué resuelve

Kapso se ubica entre tres opciones:

| Opción | Qué es | Riesgo / costo |
|---|---|---|
| **API Oficial cruda (WABA)** | Integración directa con Meta Cloud API | Configuración pesada por cliente (app, WABA, verificación, tokens, webhooks). Descartada por el usuario. |
| **Evolution API** (actual) | Wrapper no oficial sobre WhatsApp Web (Baileys) | Funciona y es libre, pero **a Meta no le gusta**: riesgo de ban permanente del número. Sin ventana de 24 h ni templates. |
| **Kapso** | **Tech Provider/BSP oficial** sobre la Cloud API | Cumple términos de Meta, onboarding simplificado, SDK TS. Hereda las reglas de Meta (24 h + templates). |

Sobre la API oficial, Kapso agrega: SDK TS (`@kapso/whatsapp-cloud-api`, MIT), workflows visuales no-code, inbox compartido, webhooks estructurados (HMAC, reintentos, idempotencia), funciones serverless y embedded signup para onboarding de clientes.

## 2. Sentimiento en internet (vista rápida)

- **Activo:** org GitHub `gokapso` con repos actualizados a 2026; SDK con commits recientes; hilo "Show HN" con feedback real y el fundador respondiendo.
- **Positivo pero escaso:** elogios a docs y producto ("flawless" tras meses de uso). Sin presencia en Reddit ni comunidad en español.
- **Fricciones reportadas:** requiere cuenta de Facebook Business para números de producción; features como grupos aún "soon"; sin reviews en agregadores.
- **Lectura:** confiable para empezar, pero **conviene un piloto chico antes de comprometer OnMind entero**. La ausencia de quejas es señal neutral (poco volumen), no garantía.

## 3. Implicaciones de negocio (yo como cliente de Kapso → de Meta)

- **Dueño del WABA = el cliente final, no Kapso ni yo.** Cada tenant conecta su propio número y WABA vía embedded signup; las credenciales no se comparten. Bueno para aislamiento y portabilidad.
- **Mi rol:** integrador que opera sobre los WABA de mis clientes a través de Kapso (Kapso es el BSP/Tech Provider oficial ante Meta). No me registro yo como BSP.
- **Pricing en dos capas:**
  - **Kapso** (plano por volumen): Free 2k msg/1 número; Pro ~US$25/mes 100k msg/3 números; Platform 1M msg/50 números. Más barato que el per-message de Twilio.
  - **Meta** (ver §4): cobra por template entregado; free-form en ventana = gratis. **Meta factura directo al WABA del cliente; los créditos de Kapso no cubren a Meta** (cobros separados).
- **Lock-in moderado:** el SDK espeja la API de Meta (se puede repuntar el `baseUrl`); lo que ata son workflows/serverless de Kapso si se usan.
- **Límite a vigilar:** Platform tope 50 números. Para muchos tenants confirmar tier enterprise/custom.

## 4. La regla de las 24 h, los templates y el primer mensaje (lo crítico)

Mecánica de Meta (aplica a **todo** proveedor oficial, sin excepción de tier):

- Cuando **el usuario te escribe**, se abre una **ventana de 24 h**. Cada mensaje suyo la reinicia.
- **Dentro de la ventana:** texto libre y cualquier contenido (imágenes, audio, docs, botones). **Gratis.**
- **Fuera de la ventana, o para iniciar conversación:** solo **templates pre-aprobados por Meta**, con costo según categoría.

**Costo (Meta cobra por template entregado, no por conversación; cambió jul-2025):**

| Tipo de mensaje | Costo |
|---|---|
| Free-form dentro de la ventana de 24 h | **Gratis** |
| Template **utility dentro** de la ventana de servicio (CSW) | **Gratis** |
| Template **utility fuera** de ventana | Pago (tarifa baja) |
| Template **marketing** | Pago (tarifa más alta) |
| Template **authentication** | Pago |

La tarifa exacta sale de la [rate card de Meta](https://developers.facebook.com/docs/whatsapp/pricing#rates) por país. Crear/someter/aprobar templates **no tiene costo**; solo el envío.

**El primer mensaje (la trampa del "conectá en 2 minutos"):** los 2 minutos son para **conectar el número**, no para saltarse las reglas.

- **Free-form arbitrario como primer mensaje → NO.** Un mensaje *business-initiated* (vos arrancás, el contacto no escribió) no admite texto libre: no hay ventana abierta (la abre el contacto).
- **`hello_world` → SÍ.** Meta da a todo WABA nuevo un template **pre-aprobado** `hello_world`. Ese es el "hola mundo" de la demo; se manda apenas conectás. Pero es *ese* template fijo, no texto libre tuyo.
- **Vía alternativa:** que el contacto escriba primero → abre la ventana → respondés libre.

**¿Kapso tiene privilegio por ser Meta Business Partner? NO.** El sello significa que está *aprobado para integrar* la API oficial (legitimidad + onboarding rápido), **no** permisos especiales de envío. Ningún BSP (Twilio, 360dialog, Kapso) puede mandar free-form business-initiated.

## 5. Templates: ciclo de vida, edición y automatización OnMind↔Meta

**CRUD completo vía Kapso** (proxy a la Graph API de Meta):

- **Crear / actualizar:** `POST .../{businessAccountId}/message_templates` — sin `hsm_id` crea; **con `hsm_id` (query param) actualiza**. SDK: `client.templates.create({...})`. Listar / obtener por id / eliminar: endpoints dedicados.
- **Estados:** `PENDING` → `APPROVED` / `REJECTED` / `DISABLED`. Aprobación típica **hasta 24 h** (más en cuentas nuevas). Editables: `category` y `components` (HEADER/BODY/FOOTER/BUTTONS).

**Límites de edición de Meta (clave para automatizar desde OnMind):**

- Template **APPROVED:** **1 edición/día**, **máx. 10 ediciones / 30 días**.
- Solo se edita si está en **Approved, Rejected o Paused**. **Rejected/Paused → ediciones ilimitadas.**
- **No** se puede cambiar **nombre, categoría ni idioma** de un aprobado (eso obliga a crear uno nuevo).
- Cada edición **dispara re-aprobación** → vuelve a `PENDING`.

**¿Se puede automatizar "el usuario crea/edita la plantilla en OnMind y se refleja en Meta"? Sí, pero con cuatro fricciones que hoy no existen con Evolution:**

1. **No es instantáneo:** crear/editar dispara aprobación (hasta 24 h). La UI debe mostrar estado y bloquear envío hasta `APPROVED`.
2. **Cuerpo fijo, variables dinámicas:** cambiar el **valor** de `{{nombre}}` al enviar NO requiere re-aprobación; cambiar el **texto fijo** sí, y con tope de frecuencia (1/día, 10/mes). → tratar el texto del template como **estable** y mover lo que cambia seguido a variables.
3. **Por tenant (por WABA):** los templates se crean por `businessAccountId`. N tenants × M plantillas, cada uno con su ciclo de aprobación y estado a sincronizar.
4. **Los "personalizados" no entran:** su gracia es el texto libre → solo se pueden enviar **dentro de la ventana de 24 h**; fuera, no hay forma sin convertirlos en template aprobado.

## 6. Onboarding del cliente final (¿cuánto "infierno de Meta" sufre?)

El `setup link` abre el **Embedded Signup** de Meta: popup guiado donde el cliente loguea con Facebook y queda todo creado/conectado. **No navega el Business Manager a mano.** Único requisito duro: **una cuenta de Facebook**.

- **¿Sin Business Manager?** El embedded signup **lo crea ahí mismo** (pide nombre del negocio, teléfono, dirección). El Business Manager (Meta Business Portfolio) es del cliente; yo solo opero vía Kapso.
- **¿Solo tiene un "WhatsApp común"?** Un número no puede estar en la app y en la API a la vez. Las tres opciones que ofrece Kapso resuelven cada caso:

| Opción (web Kapso) | Qué resuelve | Fricción |
|---|---|---|
| **Instant setup** (número US) | Kapso provisiona un número nuevo | **Cero conflicto**, lo más rápido. Pero es número US, no el del cliente. |
| **Use your own SIM** | Usa el número real del cliente | Si ese número **ya tiene WhatsApp, hay que borrar esa cuenta primero**. |
| **WhatsApp Business app** (Coexistence) | Conecta el número manteniendo la app de WhatsApp Business en paralelo | **Sin migración, conserva chats.** Ideal si ya usa WhatsApp Business. |

- **Verificación de negocio:** **NO** hace falta para arrancar. Tier no verificado permite enviar con límites (~250 conversaciones iniciadas por el negocio / 24 h). La verificación (subir documentos en el Business Manager — la parte "horrible") **solo para escalar volumen**, y es diferible.

**Resumen para el cliente:** (1) cuenta de Facebook; (2) decidir número (nuevo de Kapso / su SIM / Coexistence); (3) click al link → login → confirmar datos → verificar número por SMS (~5 min, todo en el popup); (4) cargar método de pago en Meta (ver abajo); (5) más adelante y solo si escala, verificación con documentos.

### 6.1 Billing: el pago a Meta lo pone el cliente (Kapso NO intermedia)

Dos facturaciones **separadas e independientes**:

| Concepto | Quién paga | Cómo |
|---|---|---|
| **Plan de Kapso** (plataforma) | **Yo** (cuenta de integrador) | Mi tarjeta/suscripción en Kapso |
| **Conversaciones/templates de Meta** | **Cada cliente** (dueño del WABA) | **Su propia tarjeta**, en el Billing Hub de Meta |

Textual de Kapso: *"Meta bills your credit card directly through your WABA. Kapso does not charge Meta fees on your behalf. Kapso and Meta bill separately."* No hay wallet ni línea de crédito de Kapso que cubra a Meta.

**Lo que el cliente sí tiene que hacer en el panel de Meta** (único paso que el embedded signup NO resuelve):

1. Agregar **método de pago** (tarjeta) en el **Billing Hub** de Meta:
   - `business.facebook.com/latest/settings/whatsapp_account`
   - `business.facebook.com/latest/billing_hub/accounts/details`
2. Posible **info fiscal / datos del negocio** según el país.
3. Meta **factura directo según uso** (cobra a la tarjeta al llegar a un umbral).

**Modo de falla:** sin método de pago, los templates se **bloquean** (errores *"payment method issue"* / *"not payment eligible"*). Kapso lo expone en health checks.

---

## 7. Integración con Tenis Tracker (caso simple — piloto)

Tenis Tracker ya manda mail (OTP, digest de curado vía Resend) y tiene el patrón services → actions. Un servicio de "enviar y recibir mensajes" con Kapso es directo:

- **Envío:** `whatsapp-service.ts` que llame al SDK (`sendText`/template) — Server Action, igual que `email-service.ts`.
- **Recepción:** API route `src/app/api/webhooks/kapso/route.ts` (patrón ya usado en `api/cron/curation`), validando firma HMAC.
- **Config:** `KAPSO_API_KEY` + `phoneNumberId` en env.
- **Templates:** para Tenis Tracker (un solo número; avisos tipo "tenés catálogo para curar" o un OTP por WhatsApp) basta 1–2 templates utility/auth aprobados. Como las notificaciones son *salientes proactivas*, casi siempre van por template.

**Veredicto:** piloto ideal y de bajo riesgo. Valida (a) onboarding Kapso/Meta end-to-end con número real, (b) ciclo de aprobación de templates, (c) deja un `whatsapp-service` reutilizable. Sin valor de negocio en juego si algo falla.

---

## 8. Integración con OnMind (el objetivo real)

### 8.1 Estado actual (Evolution API)

OnMind (Next.js 16 + Prisma 6, multi-tenant por `Client`) usa **Evolution API v2** centralizada (`EvolutionServer` → `WhatsappInstance` por cliente). ~2000 líneas en `src/lib/evolution-api/` + 7 servicios + webhook. Hoy **asume texto libre en cualquier momento**; no hay ventana de 24 h ni templates de Meta. Sus "templates" son **plantillas locales** con variables (`{{nombre}}`), sin aprobación.

| Tipo de saliente | Origen | ¿Dentro de la ventana de 24 h? |
|---|---|---|
| **Manual** (consola Conversaciones) | Operador escribe texto libre | A veces (<24 h); a menudo **no**. |
| **Programados** (cumpleaños, fechas, follow-up, categoría) | Cron/QStash | **Casi nunca** — proactivos. |
| **Campañas / broadcast** | QStash por lotes a audiencia fría | **Nunca** — proactivo a fríos. |
| **Ad-lead follow-up** | Disparado por inbound del lead | **Sí** normalmente. |

### 8.2 Qué cambia al migrar (no es cambio de proveedor, es cambio de modelo de mensajería)

- **Programados y campañas → requieren templates aprobados de Meta.** Mapear las plantillas locales a templates de Meta (utility para recordatorios/fechas; marketing para promos, más caro). Variables siguen siendo dinámicas; el cuerpo fijo se pre-aprueba (ver §5).
- **Ad-lead follow-up → mayormente OK con free-form** (dentro de la ventana). Cuidado si el follow-up 2 cae **después de 24 h** → necesita template.
- **Manual (consola) → ver 8.3.**

### 8.3 La pregunta concreta: mensaje manual a un contacto frío

> *"Mensaje manual a un contacto que hace 1 mes no escribe, ¿los templates son limitante?"*

**Sí, limitante dura — de Meta, no de Kapso.** Si pasaron >24 h desde el último mensaje *del contacto*, el operador **no puede** escribir texto libre. Debe: (1) enviar un **template aprobado** de reactivación para reabrir, **o** (2) esperar a que el contacto responda (su respuesta abre la ventana → free-form gratis).

Implicación de producto para la consola:
- Guardar `lastInboundAt` por conversación y **saber si la ventana está abierta/cerrada**; si cerrada, **ofrecer template** en vez de texto libre.
- Mantener un **catálogo de templates de reactivación aprobados**.
- Cambio de UX notable respecto al "escribí lo que quieras cuando quieras" de Evolution.

### 8.4 Impacto técnico de migración (medio-alto)

- **Mantener** (agnóstico): persistencia (`message-service`), modelos `Conversation`/`Message`/`MessagePart`, lógica de BD del webhook.
- **Refactorizar:** capa `evolution-api/*` (envío) → SDK Kapso; parsing del webhook; `whatsapp-send-service` (JID/fallback AR +9 — confirmar manejo en Kapso); calls en campañas, programados y ad-leads.
- **Nuevo:** gestión de **templates de Meta** por tenant (crear/versionar/estado, §5); **tracking de ventana de 24 h** + lógica free-form vs template; **onboarding embedded signup** por cliente (reemplaza alta por QR); manejo de identidad sin número (**BSUID**, `business_scoped_user_id`).

### 8.5 Coexistence, inicio de conversación en frío y por qué Evolution queda afuera

Los clientes de OnMind son **agentes inmobiliarios que usan su número de siempre** como herramienta principal y casi todos tienen WhatsApp Business. El modo correcto es **Coexistence**: el número queda en la app del celular **y** en la Cloud API a la vez, con mensajes espejados por webhook. El agente sigue chateando desde su teléfono; OnMind ve y manda por el mismo número. (Caveats de Coexistence en §6: WhatsApp Web se desvincula al onboarding y conviene encaminar el escritorio a la consola de OnMind; abrir la app cada ≤14 días; Windows desktop no soportado.)

**El problema central de OnMind:** los **mensajes programados son business-initiated, a contactos conocidos del agente, distribuidos en el año, sin intervención del agente** (mantener el vínculo: "Hola, ¿cómo va la casa nueva?" un mes post-venta, luego cada 1–2 meses). Esto descarta dos "atajos":

- **No sirve "que el agente inicie a mano desde la app".** Aunque la app permite free-form sin template (la regla de 24 h es solo de la API), pedirle al agente que arranque cada conversación rompe el sentido de "programado" — el feature existe justo para que no tenga que acordarse.
- **No sirve Evolution como fallback para iniciar.** Aunque Evolution (Baileys) emula el protocolo de WhatsApp Web y **no es trivial de distinguir a nivel de protocolo**, la detección de Meta es **mayormente conductual** y banea clientes no oficiales activamente. Peor aún: meterlo en el **mismo número que está en Coexistence** (a) cae en la inestabilidad de vincular dispositivos extra y (b) **expone el WABA oficial a detección** — arriesga justo el activo a proteger. Usarlo en otro número pierde el valor del vínculo. **Evolution queda fuera del flujo oficial, incluso como fallback puntual.**

**Conclusión de diseño:** para los programados, **templates aprobados vía Kapso**, sin acción del agente. Para iniciar en frío manualmente (caso raro), el agente puede hacerlo desde su app (free-form, oficial, gratis) y se sincroniza a OnMind.

**Estrategia de aprobación anticipada de templates** (resuelve el edge case sin Evolution):

1. **Aprobar al crear, no al enviar:** OnMind somete el template a Meta apenas el usuario lo crea; los programados futuros (mes que viene, cada 1–2 meses) salen sobrados de tiempo.
2. **Sembrar templates genéricos pre-aprobados** en el onboarding del tenant (cumpleaños, post-venta, check-in); el usuario solo ajusta variables → sin re-aprobación.
3. **Aceptar unas horas de delay** en el caso marginal "template creado hoy, dispara hoy": utility suele aprobarse en minutos/horas. No justifica montar Evolution + riesgo sobre el número oficial.

### 8.6 Categoría y costo real para OnMind

Los mensajes de "mantener el vínculo" **probablemente Meta los clasifique como MARKETING** (no transaccionales) — la categoría más cara y la que más se recategoriza/rechaza. **La palanca de categoría es la decisión económica clave.**

Tarifa Meta **por mensaje entregado** (rate card abril 2026, según país del *destinatario* — contactos en **Uruguay**; Meta factura al WABA del cliente):

| País del contacto | Marketing / msg | Utility / msg |
|---|---|---|
| **Uruguay** | $0.0740 | $0.0113 |

Costo mensual por cliente de OnMind (300–500 programados/mes):

| Categoría | 300 msg | 500 msg |
|---|---|---|
| Marketing | $22.2 | $37.0 |
| Utility | $3.4 | $5.6 |

- **Diferencia marketing vs utility: ~6.5×** ($0.0740 → $0.0113). Redactar templates con tono servicio/transaccional para que aprueben como **utility** puede bajar el costo de **$37 a $5.6** por cliente/mes. Vale el esfuerzo de copywriting.
- **Quién paga:** Meta factura directo al WABA de la inmobiliaria; OnMind decide si lo absorbe o lo traslada.
- **Kapso aparte:** 300–500 msg/mes/cliente entra holgado en los planes (Free 2k, Pro 100k); el plan escala por *total* de la cuenta de integrador. El costo dominante y variable es el de Meta de arriba.
- **Orden de magnitud:** 20 inmobiliarias × 400 msg/mes ≈ 8.000 msg/mes ≈ **~$592/mes** (marketing) vs **~$90/mes** (utility), repartido entre los WABA de los clientes.
- **Caveat:** Meta actualiza tarifas periódicamente; confirmar en el [rate card oficial](https://developers.facebook.com/docs/whatsapp/pricing) con la cuenta creada.

### 8.7 Billing por tenant y bandera estratégica

El costo de Meta (§8.6) lo paga **cada inmobiliaria directo a Meta** con su tarjeta (mecánica general en §6.1). Implicaciones para OnMind:

- **Onboarding guiado:** tras el embedded signup, llevar al cliente a cargar la tarjeta en el Billing Hub (con los links de §6.1). Sin eso, sus programados **no salen**.
- **Health-check por tenant:** detectar el estado "payment method issue" que expone Kapso y **mostrarlo en OnMind**, para saber qué tenants no pueden enviar **antes** de que falle un programado.
- **Bandera estratégica (límite de Kapso):** como Kapso **no** intermedia el pago a Meta, **no se puede ofrecer un "todo incluido" donde el cliente nunca toca Meta** — cada inmobiliaria tiene relación de pago directa con Meta y recibe sus cargos. Si el modelo deseado fuera "yo absorbo Meta y cobro un fijo, el cliente no ve a Meta", haría falta un **BSP con _credit-line sharing_** (Twilio, 360dialog, etc., que pagan a Meta y re-facturan). Decisión a tomar **antes** de comprometerse con Kapso.

---

## 9. Recomendación

1. **Piloto en Tenis Tracker** (§7): valida onboarding, templates y SDK end-to-end con riesgo cero.
2. **Antes de tocar OnMind, decidir estrategia de templates + ventana de 24 h** — es el verdadero trabajo, no la API. Inventariar qué mensajes son proactivos (→ template) vs. reactivos (→ free-form).
3. **Onboarding de clientes con Coexistence** (§8.5): su número de siempre, app del celular en paralelo, cero migración.
4. **Estrategia de aprobación anticipada de templates** (§8.5): aprobar al crear + sembrar genéricos pre-aprobados. **No usar Evolution como fallback** ni siquiera puntual: arriesga el WABA oficial.
5. **Optimizar categoría utility vs marketing** (§8.6): es la mayor palanca de costo (~6.5× en Uruguay). Copywriting de templates con tono servicio.
6. **Definir el modelo de billing ANTES de comprometerse** (§6.1, §8.7): con Kapso cada cliente paga Meta directo con su tarjeta; no hay "todo incluido". Si se necesita un único punto de cobro, evaluar BSP con credit-line sharing. Incluir en el onboarding el paso de cargar tarjeta + un health-check de "payment method".
7. **Migrar OnMind por capas:** primero lo reactivo (ad-leads, respuestas en ventana), después programados/campañas (templates).
8. Tratar el **costo de Meta por template** como variable de negocio nueva (Evolution era "gratis"): modelar volumen × tarifa por categoría/país (tabla §8.6) y decidir si se absorbe o traslada.

## 10. Preguntas abiertas

- ¿Tier de Kapso para el volumen real de tenants de OnMind? (Platform tope 50 números — ¿enterprise?)
- ¿Kapso normaliza el JID/formato AR (+9) o hay que portar `number-format.ts`?
- ¿Soporta todos los tipos que usa OnMind (audio PTT, documentos, stickers)?
- ¿Aprobación de templates por tenant escala operativamente (decenas de clientes × varios templates)?
- ¿Webhooks/eventos de cambio de estado de template (approved/rejected) para sincronizar a OnMind? (no confirmado en docs)
- ¿Política de migración de contactos/conversaciones históricos de Evolution?
- ¿Qué categoría asigna Meta en la práctica a los mensajes de "mantener vínculo" de OnMind (utility vs marketing)? Validar con templates reales.
- ¿Confirmar tarifas de Uruguay en el rate card oficial con la cuenta ya creada (las de §8.6 son de fuente terciaria, abril 2026)?

## Referencias

- Docs Kapso: https://docs.kapso.ai/docs/introduction · pricing/FAQ: https://docs.kapso.ai/docs/whatsapp/pricing-faq
- SDK TS: https://docs.kapso.ai/docs/whatsapp/typescript-sdk/introduction · webhooks: https://docs.kapso.ai/docs/platform/webhooks/overview
- Templates (guía + CRUD + lifecycle): https://docs.kapso.ai/docs/whatsapp/templates/simple-text · https://docs.kapso.ai/docs/whatsapp/templates/lifecycle.md
- Multi-tenant / onboarding: https://docs.kapso.ai/docs/platform/customer-guide
- Meta — rate card: https://developers.facebook.com/docs/whatsapp/pricing#rates · templates: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/
- Meta — phone numbers / registración: https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers
- Límites de edición de templates: https://gurusup.com/blog/whatsapp-api-message-templates
- GitHub: https://github.com/gokapso · Hacker News: https://news.ycombinator.com/item?id=46368379
- OnMind (estado actual): `src/lib/evolution-api/`, `src/services/{whatsapp-send,evolution-webhook,campaign-process,qstash-scheduled-message,ad-lead-send}-service.ts`

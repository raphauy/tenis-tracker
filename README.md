# Tenis Tracker

App de **tracking de tenis** para jugadores amateur de torneos uruguayos (AUT Grados, Academia MG y otros). Cada jugador lleva su carrera privada (participaciones, partidos y marcador por sets) y la publica como un **perfil público** con timeline de torneos y estadísticas al estilo ATP.

Además incluye:

- **Cuadros externos** (`/cuadros`) — brackets públicos de torneos de terceros, sincronizados desde fuentes externas (Academia MG vía Google Sheets, AUT/MUR vía Supabase) y servidos desde nuestra DB.
- **Auth por WhatsApp** — login y registro por _magic-link inverso_ (el usuario manda un código por WhatsApp, vía Kapso), con email verificado como puerta de respaldo.
- **Notificaciones** — avisos por email y/o WhatsApp cuando un jugador favorito registra un resultado nuevo en un cuadro externo.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Prisma 6** + **PostgreSQL** (Neon serverless)
- **NextAuth v5** — autenticación por OTP / código de sesión
- **Tailwind CSS 4** + **shadcn/ui** (sobre **Base UI**, no Radix)
- **Kapso** (WhatsApp Cloud API) · **Resend** + React Email · **Vercel Blob** (avatares)
- **pnpm** como gestor de paquetes · **Vitest** para tests · deploy en **Vercel**

## Requisitos

- Node.js 20+
- pnpm
- Una base PostgreSQL (Neon recomendado)

## Setup

```bash
pnpm install        # instala dependencias (corre prisma generate en postinstall)
# crear .env.local con las variables de abajo
pnpm db:migrate     # aplica las migraciones de Prisma
pnpm db:seed        # opcional: datos de ejemplo
pnpm dev            # http://localhost:3000
```

> El script `dev` corre con `TZ=UTC` para reproducir el entorno de Vercel y cazar bugs de timezone.

### Variables de entorno

| Variable | Para qué |
|----------|----------|
| `DATABASE_URL` / `DIRECT_DATABASE_URL` | Conexión a PostgreSQL (pooled / directa para migraciones) |
| `AUTH_SECRET` | Secreto de NextAuth |
| `NEXT_PUBLIC_APP_URL` | URL base de la app (links en emails/WhatsApp) |
| `CRON_SECRET` | Protege los endpoints de cron (curación, sync, digest) |
| `KAPSO_API_KEY` · `KAPSO_PHONE_NUMBER_ID` · `KAPSO_PROJECT_ID` · `KAPSO_WEBHOOK_SECRET` | Integración WhatsApp (Kapso) |
| `NEXT_PUBLIC_WA_NUMBER` | Número de WhatsApp del proyecto (botón `wa.me` del login) |
| `RESEND_API_KEY` · `EMAIL_FROM` | Envío de emails (OTP, notificaciones) |
| `BLOB_READ_WRITE_TOKEN` | Subida de avatares a Vercel Blob |
| `GOOGLE_SHEETS_API_KEY` · `MUR_SUPABASE_ANON_KEY` | Fuentes de cuadros externos (Academia MG / AUT-MUR) |
| `DO_NOT_SEND_EMAILS` · `DO_NOT_SEND_WHATSAPP` | Flags de dev para silenciar envíos salientes |

## Comandos

```bash
pnpm dev          # servidor de desarrollo (TZ=UTC)
pnpm build        # build de producción
pnpm start        # servir el build
pnpm typecheck    # chequeo de tipos (tsc --noEmit)
pnpm lint         # ESLint
pnpm test         # tests (Vitest, watch)
pnpm test:run     # tests una sola corrida

pnpm db:migrate   # prisma migrate dev
pnpm db:generate  # regenerar el cliente de Prisma
pnpm db:studio    # Prisma Studio
pnpm db:seed      # poblar con datos de ejemplo
```

Antes de dar una tarea por terminada: `pnpm typecheck` y luego `pnpm build` deben pasar.

## Arquitectura

```
UI (RSC por defecto) → Server Actions → Services → Prisma
                    ↘ API Routes (solo webhooks, cron, APIs externas)
```

| Capa | Ubicación | Responsabilidad |
|------|-----------|-----------------|
| Services | `src/services/*-service.ts` | Única capa que usa Prisma directamente |
| Actions | `actions.ts` en la carpeta de la ruta | Orquestación interna; devuelven `ActionResult<T>` |
| API Routes | `src/app/api/` | Solo webhooks (Kapso), cron jobs y APIs externas |
| UI | `src/app/`, `src/components/` | RSC por defecto; `"use client"` solo si hay interactividad |

Detalles, convenciones y _gotchas_ en [`CLAUDE.md`](./CLAUDE.md) y [`AGENTS.md`](./AGENTS.md).

## Estructura del proyecto

```
src/
  app/            # rutas (App Router): /[slug], /cuadros, /admin, /login, /api
  components/     # UI — ui/* (shadcn sobre Base UI), match, cuadros, profile, emails
  services/       # acceso a datos (Prisma)
  lib/            # validaciones (Zod), tennis (stats/scores), cuadros (adapters), notifications
  proxy.ts        # gate de sesión/slug/rol (reemplaza a middleware.ts en Next 16)
prisma/           # schema, migraciones y seed
docs/             # PRPs, roadmap, ADRs, glosario del dominio y notas técnicas
```

## Documentación

- **`docs/context.md`** — glosario del lenguaje ubicuo del dominio (fuente única de términos).
- **`docs/PRPs/`** — por cada feature, su `-prp.md` (diseño) y `-roadmap.md` (fases). El MVP es una feature más.
- **`docs/roadmap/`** — índice de producto de alto nivel (features y su orden).
- **`docs/adr/`** — Architecture Decision Records.
- **`docs/dev/`** — notas técnicas (ej. `base-ui-gotchas.md`).

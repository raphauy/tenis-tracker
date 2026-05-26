# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Comunicarse siempre en español con el usuario.**

@AGENTS.md

## Project Overview

> _Pendiente: completar tras el PRP inicial (`docs/PRPs/`)._

Aplicación de tracking de tenis. El alcance funcional concreto se define en el PRD/PRP de `docs/`.

## Tech Stack

- **Next.js 16** con App Router (React 19)
- **TypeScript 5+**
- **Prisma 6** + PostgreSQL (Neon serverless)
- **NextAuth v5** (OTP-based authentication)
- **Tailwind CSS 4** + shadcn/ui
- **pnpm** como gestor de paquetes

> Las dependencias arriba son la _intención_ del stack. Lo realmente instalado se ve en `package.json` y se va agregando a medida que aparece en el roadmap.

## Commands

```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm typecheck    # TypeScript type checking
pnpm lint         # ESLint
pnpm db:migrate   # Prisma migrations: npx prisma migrate dev --name my_name
pnpm db:generate  # Regenerate Prisma client
pnpm db:studio    # Open Prisma Studio
```

**Verificación obligatoria antes de dar una tarea por terminada:**
```bash
pnpm run typecheck   # Primero - corregir errores de tipos
pnpm run build       # Solo después de que typecheck pase
```

## Architecture

```
UI (RSC por defecto) → Server Actions → Services → Prisma
                    ↘ API Routes (solo externos)
```

### Layer Responsibilities

| Layer | Location | Purpose |
|-------|----------|---------|
| Services | `src/services/*-service.ts` | Única capa que usa Prisma directamente |
| Actions | `actions.ts` en la carpeta de la ruta | Orquestación interna, llama a services |
| API Routes | `src/app/api/` | Solo para webhooks, cron jobs, APIs externas |
| UI | `src/app/`, `src/components/` | RSC por defecto. `"use client"` solo si hay interactividad |

## Key Patterns

### Services (src/services/)
```typescript
import { prisma } from '@/lib/prisma'

// Funciones, no clases
export async function getThings(filters?: ThingFilters) { }

// Lanzar errores directamente (las actions los capturan)
if (!thing) throw new Error('No encontrado')
```

### Server Actions (actions.ts)
```typescript
'use server'

// Tipo de retorno estándar
type ActionResult<T> = { success: true; data?: T } | { success: false; error: string }

// Revalidar después de mutaciones
revalidatePath('/ruta/afectada')
```

### Validation (src/lib/validations/)
```typescript
import { createThingSchema } from '@/lib/validations/thing'

const validated = createThingSchema.safeParse(data)
if (!validated.success) return { success: false, error: 'Datos inválidos' }
```

### UI Components
```typescript
// SIEMPRE los componentes de src/components/ui/* (shadcn sobre Base UI). HTML crudo solo para
//   layout (div/ul/form/...); NUNCA para controles (usar Input/Button/Select/etc., no <input>/<button>).
// "use client" SOLO cuando hace falta (forms, clicks, hooks de estado)
// Suspense + Skeleton para loading (NO loading.tsx)
<Suspense fallback={<ThingsSkeleton />}>
  <ThingsList />
</Suspense>

// Captura de datos = SIEMPRE <form onSubmit> + <Button type="submit"> (para que Enter envíe),
//   aunque sea un solo campo en un diálogo. Patrón en docs/dev/base-ui-gotchas.md §8.
```

## Naming Conventions

- Files: `kebab-case` → `match-service.ts`, `player-form.tsx`
- Functions: `camelCase` → `getMatches()`, `createPlayer()`
- Components: `PascalCase` → `MatchForm`, `PlayerList`
- Types: `*WithRelations`, `*Filters`, `Create*Input`, `Update*Input`

## Important Notes

### Next.js 16 Specifics
- `middleware.ts` fue reemplazado por `proxy.ts` en Next.js 16
- Usar `src/proxy.ts` para interceptar requests

### UI: shadcn sobre Base UI (NO Radix)
- `components.json` usa `"style": "base-nova"` → los primitives son **Base UI** (`@base-ui/react/*`), no Radix. La API difiere del shadcn clásico que asume el conocimiento general.
- Antes de usar un primitive nuevo, leer `src/components/ui/<comp>.tsx`. Gotchas documentados en `docs/dev/base-ui-gotchas.md` (ej.: `render` en vez de `asChild`; `Menu.GroupLabel` requiere `Menu.Group`; los items traen `cursor-default` → cambiar a `cursor-pointer`).

### What NOT to Do
- Escribir strings en español sin tildes (á, é, í, ó, ú, ñ)
- Usar Prisma fuera de services
- Crear API routes para consumo interno (usar actions)
- Agregar `"use client"` a componentes sin interactividad
- Usar try-catch en services (solo en actions)
- Crear clases para services (usar funciones)
- Usar `loading.tsx` (usar Suspense + Skeleton)
- Usar HTML crudo para controles (input/button/select) en vez de `src/components/ui/*`
- Botón primario de captura fuera de un `<form>` con `type="submit"` (rompe el Enter)

## Database

Prisma schema en `prisma/schema.prisma`. Los modelos concretos se definen en los PRPs (`docs/PRPs/`).

## Plan Mode

- Hacer el plan extremadamente conciso. Sacrificar gramática por concisión.
- Al final del plan, listar preguntas no resueltas si las hay.

## Docs

- `docs/context.md` — glosario de lenguaje ubicuo del dominio (se llena lazy durante `grill-me`).
- `docs/PRPs/` — por cada feature, dos archivos: `<feature>-prp.md` (diseño completo: goal, decisiones cerradas, blueprint con task list) y `<feature>-roadmap.md` (fases secuenciales en prosa, sin checkboxes de tareas). El MVP se trata como una feature. Una fase se aterriza con `/grill-me` + plan mode.
- `docs/roadmap/` — índice de producto de alto nivel (features/épicas y su orden). NO lleva el detalle por fase — eso vive en el roadmap de cada feature en `docs/PRPs/`.
- `docs/adr/` — Architecture Decision Records.
- `docs/new-features/` — borradores de features antes de PRP.
- `docs/dev/` — notas técnicas, code reviews extensas.
- `docs/deploy/` — notas de deploy por feature.

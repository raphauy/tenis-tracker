---
description: Prime agent with codebase understanding
---

# Prime: Load Project Context

## Objective

Construir un entendimiento integral del codebase analizando estructura, documentación y archivos clave.

## Process

### 1. Analizar estructura del proyecto

Listar todos los archivos tracked:
!`git ls-files`

Mostrar estructura de directorios:
!`find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.next/*' -not -path '*/dist/*' -not -path '*/_generated/*' | sort`

### 2. Leer documentación core

- Leer `CLAUDE.md` (reglas globales y convenciones) y `AGENTS.md`
- Leer `README.md` en la raíz
- Leer documentación de arquitectura en `docs/`
- Leer el glosario del dominio: `docs/context.md`
- Si existe, leer el schema de Prisma: `prisma/schema.prisma`
- Listar features en `docs/PRPs/` (cada una con su `<feature>-prp.md` + `<feature>-roadmap.md`) y el índice de producto en `docs/roadmap/`

### 3. Identificar archivos clave

Basado en la estructura, identificar y leer (si existen):

- Entry points: `src/app/layout.tsx`, `src/app/page.tsx`
- Configuración: `package.json`, `tsconfig.json`, `next.config.ts`, `components.json`
- Schema/modelos: `prisma/schema.prisma`
- Auth: `src/lib/auth.ts`, `src/proxy.ts`
- Services importantes: `src/services/*.ts`
- Validaciones: `src/lib/validations/*.ts`

### 4. Entender el estado actual

Actividad reciente:
!`git log -10 --oneline`

Branch y status:
!`git status`

## Output Report

Resumen conciso y escaneable cubriendo:

### Project Overview
- Propósito y tipo de aplicación
- Tecnologías y frameworks principales
- Estado/versión actual

### Architecture
- Estructura general y organización
- Patrones arquitectónicos identificados
- Directorios importantes y su propósito

### Tech Stack
- Stack declarado en `CLAUDE.md` vs. lo realmente instalado en `package.json`
- Diferencias o pendientes notables

### Database Schema
- Tablas, relaciones e índices
- Campos o convenciones notables (o "todavía no hay schema" si aplica)

### Core Principles
- Convenciones de código observadas
- Patrones de componentes (client vs server)
- Patrones de actions (`ActionResult<T>`)

### Current State
- Branch activa
- Cambios recientes o foco de desarrollo
- Observaciones u observaciones inmediatas

**Hacer este resumen fácil de escanear — usar bullets y headers claros.**

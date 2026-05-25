---
name: "revisar"
description: "Revisa código modificado verificando correctitud, validaciones, regresiones y adherencia a patrones del proyecto"
---

# Code Review Skill

Revisión exhaustiva del código modificado para garantizar correctitud, consistencia y que no se rompa funcionalidad existente.

## Proceso de Revisión

### Paso 1: Identificar cambios

```bash
git diff --name-only          # Archivos modificados (unstaged)
git diff --cached --name-only # Archivos modificados (staged)
```

Leer cada archivo modificado completo para entender el contexto.

### Paso 2: Revisar correctitud del código

Para cada archivo modificado, verificar:

- **Lógica de negocio**: La implementación resuelve correctamente lo que se pide, sin edge cases sin cubrir
- **Tipos TypeScript**: No hay `any` innecesarios, tipos correctos para params/returns, genéricos bien usados
- **Null safety**: Manejo correcto de valores `null | undefined`, optional chaining donde corresponde
- **Async/await**: No hay promesas sin await, no hay race conditions, errores async propagados correctamente

### Paso 3: Validaciones y schemas

- Schemas Zod actualizados tanto en **cliente** como en **servidor** cuando se agregan/modifican campos
- Campos `nullable()` / `optional()` usados correctamente según la intención
- Validación de entrada en Server Actions antes de llamar al servicio
- Mensajes de error en español

### Paso 4: Análisis de regresión

Verificar que los cambios **no rompen funcionalidad existente**:

- **Contratos de funciones**: Si se cambió la firma de un servicio/action, buscar TODOS los call sites con `Grep` y confirmar que siguen siendo compatibles
- **Prisma queries**: Si se modificó un `select`/`include`, verificar que los consumidores del resultado no acceden a campos que ya no se incluyen
- **Schemas compartidos**: Si se modificó un schema Zod, verificar todos los formularios/actions que lo usan
- **Tipos exportados**: Si se cambió un type/interface, buscar todos los imports y confirmar compatibilidad
- **Componentes reutilizados**: Si se modificaron props de un componente, buscar todos los usos y verificar que pasan los props requeridos
- **Rutas y revalidación**: Si se agregó/cambió un `revalidatePath`, confirmar que la ruta es correcta

```bash
# Ejemplo: buscar todos los usos de una función modificada
grep -r "nombreFuncion" src/ --include="*.ts" --include="*.tsx"
```

### Paso 5: Adherencia a patrones del proyecto

Verificar las reglas de CLAUDE.md:

| Regla | Verificación |
|-------|-------------|
| Prisma solo en services | No hay `prisma.` fuera de `src/services/` |
| RSC por defecto | `"use client"` solo si hay interactividad real |
| No `loading.tsx` | Se usa `Suspense` + Skeleton |
| Services sin try-catch | Try-catch solo en actions, no en services |
| Services son funciones | No se usan clases |
| ActionResult tipado | Actions retornan `{ success, data/error }` |
| Server Actions > API routes | API routes solo para webhooks/externos |

### Paso 6: Superficies UI actualizadas

Si el cambio agrega/modifica un campo o comportamiento, verificar que se actualicen **todas** las superficies:

- Formulario de creación
- Formulario/diálogo de edición
- Vista de detalle
- Listados/tablas
- Dashboard/stats si aplica
- Tooltips/badges de estado

### Paso 7: Calidad general

- Strings en español con acentos correctos (á, é, í, ó, ú, ñ)
- No hay `console.log` de debug olvidados (solo `console.error` en catches de actions)
- No hay código comentado sin justificación
- Imports no usados eliminados
- Nombres siguen convenciones: `kebab-case` archivos, `camelCase` funciones, `PascalCase` componentes

### Paso 8: Verificación automática

**Ambos comandos son obligatorios antes de emitir veredicto.** No alcanza con typecheck: el build detecta errores de RSC, imports rotos, configuración inválida y problemas que tsc no ve.

```bash
pnpm run typecheck   # Errores de tipos
pnpm run build       # Build completo - detecta errores de RSC, imports rotos, etc.
```

Si `typecheck` falla, corregí los errores antes de correr `build`. Si `build` falla, el veredicto no puede ser **SAFE**: debe ser **NEEDS_FIXES** listando el error reportado por Next.js.

Incluí en el reporte una sección **Verificación automática** indicando el resultado de cada comando (✅ pasa / ❌ falla con el error).

## Veredicto Final

Emitir uno de:

| Veredicto | Significado |
|-----------|-------------|
| **SAFE** | Sin problemas. Listo para commit/deploy |
| **NEEDS_FIXES** | Hay problemas que deben corregirse antes de avanzar. Listar cada uno con archivo y línea |
| **RISKY** | Cambios que podrían causar regresiones en producción. Explicar el riesgo específico y las áreas afectadas |

### Formato de reporte

```
## Code Review

### Archivos revisados
- `archivo1.ts` - breve descripción del cambio
- `archivo2.tsx` - breve descripción del cambio

### Hallazgos
1. [CRITICAL/WARNING/INFO] Descripción del hallazgo (`archivo:línea`)

### Regresiones potenciales
- Descripción del riesgo y componentes afectados (o "Ninguna identificada")

### Verificación automática
- `pnpm run typecheck`: ✅ pasa | ❌ falla (resumen del error)
- `pnpm run build`: ✅ pasa | ❌ falla (resumen del error)

### Veredicto: SAFE | NEEDS_FIXES | RISKY
Justificación breve.
```

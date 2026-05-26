# Base UI ≠ shadcn clásico (Radix) — gotchas

Este proyecto usa shadcn con `"style": "base-nova"` (ver `components.json`), que instala los
primitives sobre **Base UI** (`@base-ui/react/*`), **no** Radix UI. Base UI es el sucesor de Radix
(mismo equipo), pero su API difiere. El conocimiento "de memoria" de shadcn asume Radix, así que
los patrones de Radix **fallan** acá.

**Regla de oro:** antes de usar un primitive nuevo, abrí `src/components/ui/<comp>.tsx` y mirá cómo
está armado (qué subcomponentes exporta, qué `data-*` usa). No asumas la API de Radix.

## Diferencias clave (confirmadas en este repo)

### 1. Composición: `render` en vez de `asChild`
Radix usa `<X asChild><Link/></X>`. Base UI usa la prop **`render`**:
```tsx
<DropdownMenuItem render={<Link href={`/${slug}`} />}>Mi perfil</DropdownMenuItem>
<DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
```
El componente clona el elemento de `render` y le mergea sus props/estilos. Los `children` que le
pasás al componente pasan a ser los children del elemento renderizado.

### 2. `Menu.GroupLabel` DEBE ir dentro de `Menu.Group`
El bug que rompió el avatar (mayo 2026): `DropdownMenuLabel` es `Menu.GroupLabel` y lanza
`MenuGroupContext is missing` si no está envuelto en `<DropdownMenuGroup>`. En Radix el Label es
suelto; acá no.
```tsx
<DropdownMenuContent>
  <DropdownMenuGroup>          {/* obligatorio */}
    <DropdownMenuLabel>…</DropdownMenuLabel>
  </DropdownMenuGroup>
  <DropdownMenuItem>…</DropdownMenuItem>   {/* Item suelto sí es válido */}
</DropdownMenuContent>
```
Generalizá: si un "part" depende de contexto (label de grupo, indicadores, etc.), buscá su
contenedor requerido. Los `Item`/`Separator` sueltos en `Content` están bien.

### 3. Anatomía del popup: Portal + Positioner + Popup
El `Content` del wrapper de shadcn envuelve `Menu.Portal > Menu.Positioner > Menu.Popup`. El
posicionamiento (`align`, `side`, `sideOffset`) va en el Positioner, no en el Popup. Normalmente no
lo tocás (el wrapper lo resuelve), pero tenelo presente si algo de posición no responde.

### 4. Data attributes de estilo distintos
Base UI: `data-open` / `data-closed`, `data-checked` / `data-unchecked`, `data-active` (tabs),
`data-popup-open`, `data-side=...`. Radix usaba `data-state="open|closed|checked"`. Si copiás CSS o
`data-[state=...]` de ejemplos de Radix, no matchea.

### 5. Tabs es un widget con estado, no navegación
`Tabs/TabsList/TabsTrigger` controlan paneles por `value`/`onValueChange`. Para navegar entre rutas
(tipo Torneos ↔ Estadísticas) NO uses Tabs: hand-rollear `<Link>` + `usePathname` (ver
`src/components/profile/profile-nav.tsx`).

### 6. Custom components: `useRender` + `mergeProps`
Para componer primitives propios, Base UI expone `useRender` y `mergeProps` (`@base-ui/react/*`).
Ejemplo en `src/components/ui/badge.tsx`.

### 7. Los items traen `cursor-default` → cambiar a `cursor-pointer`
Los items de menú de Base UI (`dropdown-menu` Item/SubTrigger/CheckboxItem/RadioItem) vienen con
`cursor-default` hardcodeado. Regla del proyecto: todo clickeable lleva manito. Al instalar un
componente de menú/lista, reemplazar `cursor-default` → `cursor-pointer` en su className (editar el
shadcn original). Ya hecho en `dropdown-menu.tsx`; `select.tsx` ya venía con `cursor-pointer` en sus
items. Ver memoria [[ui-cursor-pointer]].

## Si algo "se queda Rendering" estando logueado
Suele ser un client component que crashea (no un loop de proxy). Reproducir con el skill
`agent-browser`: abrir la página, `click` el elemento, `agent-browser errors` / `screenshot` para
leer el overlay de error de Next. Casi siempre es un part de Base UI usado con patrón de Radix.

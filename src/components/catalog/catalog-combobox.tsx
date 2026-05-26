'use client'

import * as React from 'react'
import { InfoIcon, PlusIcon, Loader2Icon, XIcon } from 'lucide-react'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'

export type ComboOption = { id: string; label: string; deletable?: boolean }

// Item interno: Base UI usa {value,label} para mostrar el label y guardar el value.
type Item = { value: string; label: string; deletable?: boolean }
const CREATE = '__create__'

type Props = {
  options: ComboOption[]
  value: string | null
  onChange: (id: string | null) => void
  // Notifica la opción seleccionada completa (id+label), incluidas las creadas inline.
  onSelect?: (option: ComboOption | null) => void
  // Si se provee, habilita "crear nuevo". Devuelve la opción creada (ya persistida) o null.
  onCreate?: (name: string) => Promise<ComboOption | null>
  // Si se provee, muestra una "×" en las opciones borrables. Devuelve true si se borró.
  onDelete?: (id: string) => Promise<boolean>
  placeholder?: string
  createHint?: string
  disabled?: boolean
  emptyText?: string
  // Muestra una fila "crear" persistente aunque no se haya escrito nada (creación vía diálogo).
  allowEmptyCreate?: boolean
  // Texto de esa fila persistente (ej. "Crear torneo nuevo").
  createLabel?: string
  // Hint cuando la lista está vacía y la creación necesita un nombre escrito.
  createPrompt?: string
}

// Selector reutilizable elegir/crear. Elegir es primario; "crear nuevo" es secundario,
// con ícono Info + tooltip explicativo. Mismo componente en cada paso del flujo.
export function CatalogCombobox({
  options,
  value,
  onChange,
  onSelect,
  onCreate,
  onDelete,
  placeholder = 'Buscar o crear…',
  createHint,
  disabled,
  emptyText = 'Sin resultados',
  allowEmptyCreate = false,
  createLabel = 'Crear nuevo',
  createPrompt = 'Escribí un nombre para crear uno nuevo.',
}: Props) {
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  // Item resaltado (por teclado/hover): para decidir qué hace Enter.
  const [highlighted, setHighlighted] = React.useState<Item | null>(null)
  // Opciones creadas inline en esta instancia (para resolver su label sin esperar al padre).
  const [extra, setExtra] = React.useState<ComboOption[]>([])
  // Opciones borradas en esta instancia (para ocultarlas sin esperar al padre).
  const [removed, setRemoved] = React.useState<Set<string>>(new Set())

  const allOptions = React.useMemo(
    () =>
      [...options, ...extra.filter((e) => !options.some((o) => o.id === e.id))].filter(
        (o) => !removed.has(o.id)
      ),
    [options, extra, removed]
  )
  const items = React.useMemo<Item[]>(
    () => allOptions.map((o) => ({ value: o.id, label: o.label, deletable: o.deletable })),
    [allOptions]
  )
  const selectedItem = React.useMemo(
    () => items.find((i) => i.value === value) ?? null,
    [items, value]
  )

  // Sincroniza el texto del input con la opción seleccionada (incluye selección externa,
  // ej. al crear un torneo desde el diálogo). El tipeo no cambia `value`, así que no interfiere.
  const onSelectRef = React.useRef(onSelect)
  onSelectRef.current = onSelect
  React.useEffect(() => {
    setQuery(selectedItem?.label ?? '')
    onSelectRef.current?.(selectedItem ? { id: selectedItem.value, label: selectedItem.label } : null)
  }, [selectedItem])

  const trimmed = query.trim()
  const lower = trimmed.toLowerCase()
  const filtered = React.useMemo(
    () => (lower ? items.filter((i) => i.label.toLowerCase().includes(lower)) : items),
    [items, lower]
  )
  const exact = items.some((i) => i.label.toLowerCase() === lower)
  const hasQuery = trimmed.length > 0
  // "Crear «texto»" cuando se escribió algo sin coincidencia exacta.
  const showCreateTyped = !!onCreate && hasQuery && !exact
  // Fila "crear" persistente (sin escribir): solo si la creación es por diálogo.
  const showCreatePersistent = !!onCreate && !hasQuery && allowEmptyCreate
  // Pie guía: siempre que haya creación por nombre y no haya un botón "crear" accionable visible.
  const showCreateHint = !!onCreate && !allowEmptyCreate && !showCreateTyped

  async function handleCreate() {
    if (!onCreate || creating) return
    setCreating(true)
    try {
      const created = await onCreate(trimmed)
      if (created) {
        setExtra((prev) => [...prev, created])
        onChange(created.id)
        setQuery(created.label)
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!onDelete) return
    const ok = await onDelete(id)
    if (ok) {
      setRemoved((prev) => new Set(prev).add(id))
      if (value === id) onChange(null)
    }
  }

  return (
    <TooltipProvider>
      {/* Sin prop `items`: Base UI navega los items realmente renderizados (filtrado manual),
          así no hay desfasaje teclado/DOM y se llega al último. */}
      <Combobox<Item>
        value={selectedItem}
        onValueChange={(item) => {
          if (!item) return onChange(null)
          if (item.value === CREATE) {
            void handleCreate()
            return
          }
          onChange(item.value)
        }}
        inputValue={query}
        onInputValueChange={(v) => setQuery(v)}
        open={open}
        onOpenChange={setOpen}
        onItemHighlighted={(val) => setHighlighted((val as Item | undefined) ?? null)}
        disabled={disabled}
      >
        <ComboboxInput
          placeholder={placeholder}
          disabled={disabled || creating}
          showClear
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            // Si navegaste hasta un item: Base UI lo selecciona; salvo que sea "crear".
            if (highlighted) {
              if (highlighted.value === CREATE) {
                e.preventDefault()
                void handleCreate()
                setOpen(false)
              }
              return
            }
            // Sin nada resaltado: Enter prioriza una coincidencia existente.
            if (hasQuery && filtered.length > 0) {
              e.preventDefault()
              onChange(filtered[0].value)
              setOpen(false)
              return
            }
            // No hay coincidencias: recién ahí Enter crea.
            if (showCreateTyped || showCreatePersistent) {
              e.preventDefault()
              void handleCreate()
              setOpen(false)
            }
          }}
        />
        <ComboboxContent>
          <ComboboxList>
            {/* Creación arriba: visible de entrada sin tener que scrollear. */}
            {(showCreateTyped || showCreatePersistent) && (
              <ComboboxItem value={{ value: CREATE, label: trimmed }}>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {creating ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <PlusIcon className="size-3.5" />
                  )}
                  <span>
                    {showCreateTyped ? (
                      <>
                        Crear <span className="font-medium text-foreground">«{trimmed}»</span>
                      </>
                    ) : (
                      <span className="font-medium text-foreground">{createLabel}</span>
                    )}
                  </span>
                  {createHint && (
                    <Tooltip>
                      <TooltipTrigger
                        render={<span className="inline-flex cursor-help" aria-label="Ayuda" />}
                      >
                        <InfoIcon className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>{createHint}</TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </ComboboxItem>
            )}

            {showCreateHint && (
              <div className="mb-1 flex items-center gap-1.5 border-b px-2 py-2 text-xs text-muted-foreground">
                <InfoIcon className="size-3.5 shrink-0" />
                <span>{createPrompt}</span>
              </div>
            )}

            {filtered.map((item) => (
              <ComboboxItem key={item.value} value={item}>
                <span className="flex-1 truncate">{item.label}</span>
                {onDelete && item.deletable && (
                  <button
                    type="button"
                    aria-label={`Borrar ${item.label}`}
                    title="Borrar (solo si lo creaste y nadie lo usa)"
                    className="ml-auto mr-4 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      void handleDelete(item.value)
                    }}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </ComboboxItem>
            ))}

            {filtered.length === 0 && !showCreateTyped && !showCreatePersistent && !showCreateHint && (
              <div className="py-2 text-center text-sm text-muted-foreground">{emptyText}</div>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </TooltipProvider>
  )
}

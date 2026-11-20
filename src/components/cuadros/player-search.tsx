'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { SearchIcon, XIcon } from 'lucide-react'
import { isSearchableQuery } from '@/lib/cuadros/player-search'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const DEBOUNCE_MS = 300

// Buscador de jugador de /cuadros. La búsqueda vive en la URL (?q=) para que el resultado
// sea compartible y lo resuelva el server: acá solo se sincroniza el input con la URL,
// al tipear (con debounce) o con Enter.
export function PlayerSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [value, setValue] = React.useState(initialQuery)
  // Búsqueda que la URL ya refleja, y la enviada que todavía está en vuelo (null = ninguna).
  const [synced, setSynced] = React.useState(initialQuery)
  const [target, setTarget] = React.useState<string | null>(null)
  // La transición sigue pendiente mientras alguna navegación propia no haya terminado; si
  // otra navegación la pisa (ej. el link "Cuadros" del header), también termina.
  const [isNavigating, startNavigation] = React.useTransition()

  // Mantener el input alineado con la URL sin pisar lo que se está tipeando:
  // - terminó lo enviado: si la URL quedó en otra cosa, ganó una navegación ajena y el
  //   input la sigue; si quedó en lo enviado, el input ya está bien (o va más adelantado).
  // - sin nada en vuelo y la URL cambió: se navegó por fuera, el input la sigue.
  if (target !== null && !isNavigating) {
    setTarget(null)
    setSynced(initialQuery)
    if (target !== initialQuery) setValue(initialQuery)
  } else if (target === null && initialQuery !== synced) {
    setSynced(initialQuery)
    setValue(initialQuery)
  }

  // Hacia dónde está yendo la URL, para no navegar dos veces a lo mismo.
  const current = target ?? synced

  const navigate = React.useCallback(
    (raw: string) => {
      // Menos del mínimo = sin búsqueda: vuelve la lista de torneos.
      const q = isSearchableQuery(raw) ? raw.trim() : ''
      if (q === current) return
      setTarget(q)
      startNavigation(() => {
        router.replace(q ? `/cuadros?q=${encodeURIComponent(q)}` : '/cuadros', { scroll: false })
      })
    },
    [router, current]
  )

  React.useEffect(() => {
    const timer = setTimeout(() => navigate(value), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value, navigate])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(value)
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex gap-2">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar jugador por nombre o apellido…"
          aria-label="Buscar jugador"
          autoComplete="off"
          enterKeyHint="search"
          className="px-8"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setValue('')}
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          >
            <XIcon />
          </Button>
        )}
      </div>
      <Button type="submit" className="shrink-0">
        Buscar
      </Button>
    </form>
  )
}

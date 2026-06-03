import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Avatar identicon determinístico (estilo GitHub): grilla 5×5 espejada + color por seed.
// Puro y sin estado → seguro en RSC y en client, sin hydration mismatch.
// Se usa como fallback cuando el usuario no subió foto (User.image == null). Seed = User.id
// (estable: no cambia si el usuario se renombra). No se persiste; se genera en cada render.

// FNV-1a 32-bit. Determinístico, sin dependencias ni crypto.
function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function GeneratedAvatar({
  seed,
  className,
  title,
}: {
  seed: string
  className?: string
  title?: string
}) {
  const hash = hashSeed(seed)
  const color = `hsl(${hash % 360}, 65%, 50%)`

  // Solo decidimos 3 columnas × 5 filas (15 celdas); las columnas 3 y 4 espejan a 1 y 0.
  const rects: ReactNode[] = []
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 5; row++) {
      const on = ((hash >> (col * 5 + row)) & 1) === 1
      if (!on) continue
      rects.push(<rect key={`${col}-${row}`} x={col} y={row} width={1} height={1} />)
      const mirror = 4 - col
      if (mirror !== col) {
        rects.push(<rect key={`${mirror}-${row}`} x={mirror} y={row} width={1} height={1} />)
      }
    }
  }

  return (
    <svg
      viewBox="0 0 5 5"
      className={cn('size-full', className)}
      fill={color}
      role="img"
      aria-label={title ?? 'Avatar'}
      shapeRendering="crispEdges"
    >
      {rects}
    </svg>
  )
}

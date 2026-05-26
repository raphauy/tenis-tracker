import { cn } from '@/lib/utils'

// Monocromático: el marrón/terracota principal del tema (hue ~25) en distintas tonalidades.
// Claras → texto oscuro; oscuras → texto blanco. Las comunes (7ma, 6ta, 5ta, B, C, D)
// quedan en tonos bien separados y con buen contraste.
const DARK_INK = 'text-[oklch(0.32_0.12_25)]'

const TONES: Record<string, string> = {
  // Grados AUT (de más claro a más oscuro). Texto oscuro hasta el medio; blanco recién en los oscuros.
  '7ma': `bg-[oklch(0.90_0.045_25)] ${DARK_INK}`,
  '6ta': `bg-[oklch(0.78_0.080_25)] ${DARK_INK}`,
  '5ta': `bg-[oklch(0.66_0.110_25)] ${DARK_INK}`,
  '4ta': 'bg-[oklch(0.50_0.150_25)] text-white',
  '3ra': 'bg-[oklch(0.42_0.150_25)] text-white',
  '2da': 'bg-[oklch(0.33_0.120_25)] text-white',
  // Academia MG
  A: `bg-[oklch(0.90_0.045_25)] ${DARK_INK}`,
  B: `bg-[oklch(0.78_0.080_25)] ${DARK_INK}`,
  C: `bg-[oklch(0.66_0.110_25)] ${DARK_INK}`,
  D: 'bg-[oklch(0.50_0.150_25)] text-white',
  E: 'bg-[oklch(0.42_0.150_25)] text-white',
}

// Respaldo para categorías no mapeadas: tono estable por nombre, misma escala.
const FALLBACK = [
  `bg-[oklch(0.84_0.065_25)] ${DARK_INK}`,
  `bg-[oklch(0.66_0.110_25)] ${DARK_INK}`,
  'bg-[oklch(0.46_0.150_25)] text-white',
  'bg-[oklch(0.33_0.120_25)] text-white',
]

function toneFor(name: string): string {
  const key = name.trim()
  if (TONES[key]) return TONES[key]
  if (TONES[key.toUpperCase()]) return TONES[key.toUpperCase()]
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return FALLBACK[Math.abs(hash) % FALLBACK.length]
}

export function CategoryBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-11 shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold',
        toneFor(name),
        className
      )}
    >
      {name}
    </span>
  )
}

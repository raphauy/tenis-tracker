import { Badge } from '@/components/ui/badge'
import { entryResultLabel, entryResultLabelShort } from '@/lib/tennis/labels'
import type { EntryResult } from '@/lib/tennis/derive'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost'

const VARIANT_BY_KIND: Record<EntryResult['kind'], Variant> = {
  CAMPEON: 'default',
  FINALISTA: 'secondary',
  SEMIFINALISTA: 'secondary',
  ELIMINADO: 'outline',
  EN_CURSO: 'outline',
}

// Badge del resultado derivado de la Participación (Campeón, Finalista, Eliminado en…, etc.).
// `compact`: usa la etiqueta corta (solo la ronda para ELIMINADO), ideal en espacios angostos.
export function ResultBadge({ result, compact }: { result: EntryResult; compact?: boolean }) {
  return (
    <Badge variant={VARIANT_BY_KIND[result.kind]} className="whitespace-nowrap">
      {compact ? entryResultLabelShort(result) : entryResultLabel(result)}
    </Badge>
  )
}

import { Badge } from '@/components/ui/badge'
import { entryResultLabel } from '@/lib/tennis/labels'
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
export function ResultBadge({ result }: { result: EntryResult }) {
  return <Badge variant={VARIANT_BY_KIND[result.kind]}>{entryResultLabel(result)}</Badge>
}

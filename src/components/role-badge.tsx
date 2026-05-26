import { ShieldIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Badge del rol del usuario. En el MVP solo el SUPERADMIN lleva badge (el USER es lo común).
export function RoleBadge({ role, className }: { role: string; className?: string }) {
  if (role !== 'SUPERADMIN') return null
  return (
    <Badge variant="secondary" className={cn('gap-1', className)}>
      <ShieldIcon />
      Admin
    </Badge>
  )
}

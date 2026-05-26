'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// Navegación del Perfil entre Torneos y Estadísticas. Visible también al visitante.
export function ProfileNav({ slug, className }: { slug: string; className?: string }) {
  const pathname = usePathname()
  const items = [
    { href: `/${slug}`, label: 'Torneos' },
    { href: `/${slug}/stats`, label: 'Estadísticas' },
  ]

  return (
    <nav className={cn('flex gap-1 border-b', className)}>
      {items.map((it) => {
        const active = pathname === it.href
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}

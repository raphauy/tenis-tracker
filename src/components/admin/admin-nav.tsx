'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const items = [
  { href: '/admin', label: 'Curado', match: (p: string) => p === '/admin' },
  { href: '/admin/whatsapp', label: 'WhatsApp', match: (p: string) => p.startsWith('/admin/whatsapp') },
  { href: '/admin/cuadros', label: 'Cuadros', match: (p: string) => p.startsWith('/admin/cuadros') },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="mx-auto flex w-full max-w-3xl gap-1 border-b px-6">
      {items.map((it) => {
        const active = it.match(pathname)
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

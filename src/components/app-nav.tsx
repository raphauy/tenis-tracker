'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDaysIcon, TrophyIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Items de la navegación primaria (Cuadros / Mis torneos), compartidos por los links del
// header (desktop) y la bottom nav (mobile). "Mis torneos" se muestra SIEMPRE, también al
// anónimo (enseña que la funcionalidad existe): sin sesión va a /login, sin slug a /onboarding.
function navItems(pathname: string, slug: string | null, isAuthenticated: boolean) {
  const misTorneosHref = slug ? `/${slug}` : isAuthenticated ? '/onboarding' : '/login'
  return [
    {
      href: '/cuadros',
      label: 'Cuadros',
      icon: TrophyIcon,
      active: pathname === '/cuadros' || pathname.startsWith('/cuadros/'),
    },
    {
      href: misTorneosHref,
      label: 'Mis torneos',
      icon: CalendarDaysIcon,
      active: !!slug && (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)),
    },
  ]
}

type NavProps = { slug: string | null; isAuthenticated: boolean }

// Nav primaria del header, solo desktop. En mobile la reemplaza la BottomNav.
export function MainNavLinks({ slug, isAuthenticated }: NavProps) {
  const pathname = usePathname()
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {navItems(pathname, slug, isAuthenticated).map((it) => (
        <Link
          key={it.label}
          href={it.href}
          aria-current={it.active ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            it.active
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  )
}

// Bottom nav fija de mobile: las dos funcionalidades principales siempre a la vista
// (ícono + etiqueta). Los layouts que la montan reservan el alto con pb-14 (md:pb-0).
export function BottomNav({ slug, isAuthenticated }: NavProps) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid h-14 grid-cols-2">
        {navItems(pathname, slug, isAuthenticated).map((it) => (
          <Link
            key={it.label}
            href={it.href}
            aria-current={it.active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
              it.active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <it.icon className="size-5" />
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import {
  LogOutIcon,
  SettingsIcon,
  ShieldIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  UserIcon,
  BellIcon,
} from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { GeneratedAvatar } from '@/components/generated-avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { RoleBadge } from '@/components/role-badge'
import { useMounted } from '@/hooks/use-mounted'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'

type Props = {
  name: string | null
  // Desde Fase 2: email es opcional (puede no haberlo agregado todavía en el onboarding).
  email: string | null
  image: string | null
  slug: string | null
  role: string
  // Seed estable del identicon (User.id) usado como avatar cuando no hay foto.
  seed: string
}

export function UserAvatar({ name, email, image, slug, role, seed }: Props) {
  const mounted = useMounted()
  const { setTheme } = useTheme()

  // Evita hydration mismatch (el dropdown de base-ui genera ids).
  if (!mounted) return <Skeleton className="size-8 rounded-full" />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar size="lg">
          {image && <AvatarImage src={image} alt={name ?? email ?? ''} />}
          <AvatarFallback className="bg-muted p-0">
            <GeneratedAvatar seed={seed} title={name ?? email ?? 'Avatar'} />
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {name ?? 'Sin nombre'}
                </span>
                {email && (
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                )}
              </div>
              <RoleBadge role={role} className="shrink-0" />
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* La navegación primaria (Cuadros / Mis torneos) vive en el AppHeader y la
            bottom nav; este menú queda solo para lo de cuenta. */}
        {slug ? (
          <>
            <DropdownMenuItem render={<Link href={`/${slug}/notificaciones`} />}>
              <BellIcon />
              Notificaciones
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/${slug}/ajustes`} />}>
              <SettingsIcon />
              Ajustes
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem render={<Link href="/onboarding" />}>
            <UserIcon />
            Completar perfil
          </DropdownMenuItem>
        )}

        {role === 'SUPERADMIN' && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldIcon />
            Panel Admin
          </DropdownMenuItem>
        )}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SunIcon />
            Tema
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <SunIcon />
              Claro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <MoonIcon />
              Oscuro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <MonitorIcon />
              Sistema
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: '/' })}>
          <LogOutIcon />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

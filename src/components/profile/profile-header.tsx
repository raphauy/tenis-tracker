import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { OwnerAvatar } from '@/components/profile/owner-avatar'

type Viewer = {
  id: string
  name: string | null
  // Desde Fase 2, email es opcional (los logins por WhatsApp pueden no tener email todavía).
  email: string | null
  slug: string | null
  image: string | null
  role: string
} | null

// Encabezado del Perfil: avatar del dueño (foto subida → clickeable para ampliarla; sin foto →
// identicon generado) + nombre del dueño + avatar del visitante (o "Iniciar sesión" si anónimo).
// El avatar del dueño se oculta cuando el visitante ES el dueño: su propio avatar ya está arriba a la derecha.
// El CTA "+ Nuevo torneo" vive junto al buscador (ver TimelineList), no acá.
export function ProfileHeader({
  ownerId,
  ownerName,
  ownerSlug,
  ownerImage,
  isOwner,
  viewer,
}: {
  ownerId: string
  ownerName: string
  ownerSlug: string
  ownerImage: string | null
  isOwner: boolean
  viewer: Viewer
}) {
  return (
    <header className="mb-8 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {!isOwner && <OwnerAvatar image={ownerImage} seed={ownerId} name={ownerName} />}
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{ownerName}</h1>
          <Link
            href="/cuadros"
            className={buttonVariants({
              variant: 'link',
              className: 'h-auto justify-start px-0 text-sm font-normal',
            })}
          >
            Ver cuadros
          </Link>
        </div>
      </div>
      {viewer ? (
        <UserAvatar
          name={viewer.name}
          email={viewer.email}
          image={viewer.image}
          slug={viewer.slug}
          role={viewer.role}
          seed={viewer.id}
        />
      ) : (
        <Link
          href={`/login?callbackUrl=/${ownerSlug}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Iniciar sesión
        </Link>
      )}
    </header>
  )
}

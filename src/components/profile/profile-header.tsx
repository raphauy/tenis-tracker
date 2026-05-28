import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { OwnerAvatar } from '@/components/profile/owner-avatar'

type Viewer = {
  name: string | null
  // Desde Fase 2, email es opcional (los logins por WhatsApp pueden no tener email todavía).
  email: string | null
  slug: string | null
  image: string | null
  role: string
} | null

// Encabezado del Perfil: avatar (solo si hay foto, clickeable para ampliarla) + nombre del dueño +
// avatar del visitante (o "Iniciar sesión" si anónimo).
// La foto del dueño se oculta cuando el visitante ES el dueño: su propio avatar ya está arriba a la derecha.
// El CTA "+ Nuevo torneo" vive junto al buscador (ver TimelineList), no acá.
export function ProfileHeader({
  ownerName,
  ownerSlug,
  ownerImage,
  isOwner,
  viewer,
}: {
  ownerName: string
  ownerSlug: string
  ownerImage: string | null
  isOwner: boolean
  viewer: Viewer
}) {
  return (
    <header className="mb-8 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {ownerImage && !isOwner && <OwnerAvatar image={ownerImage} name={ownerName} />}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{ownerName}</h1>
      </div>
      {viewer ? (
        <UserAvatar
          name={viewer.name}
          email={viewer.email}
          image={viewer.image}
          slug={viewer.slug}
          role={viewer.role}
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

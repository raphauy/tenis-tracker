import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'

type Viewer = {
  name: string | null
  email: string
  slug: string | null
  image: string | null
  role: string
} | null

// Encabezado del Perfil: nombre del dueño + avatar del visitante (o "Iniciar sesión" si anónimo).
// El CTA "+ Nuevo torneo" vive junto al buscador (ver TimelineList), no acá.
export function ProfileHeader({
  ownerName,
  ownerSlug,
  viewer,
}: {
  ownerName: string
  ownerSlug: string
  viewer: Viewer
}) {
  return (
    <header className="mb-8 flex items-center justify-between gap-4">
      <h1 className="truncate text-2xl font-semibold tracking-tight">{ownerName}</h1>
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

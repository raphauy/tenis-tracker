import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getViewerChrome } from '@/services/user-service'
import { UserAvatar } from '@/components/user-avatar'
import { buttonVariants } from '@/components/ui/button'

// Menú de cuenta global: avatar con desplegable (Inicio, Cuadros, Mis torneos, Ajustes,
// Tema, Cerrar sesión) para el logueado, o "Iniciar sesión" para el anónimo. Server
// component: lee la sesión + data del viewer y delega el desplegable al UserAvatar. Se usa
// en los headers públicos (cuadros, landing) para tener navegación de cuenta en todas partes.
export async function AccountMenu({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const session = await auth()
  const viewer = session?.user?.id ? await getViewerChrome(session.user.id) : null

  if (viewer) {
    return (
      <UserAvatar
        name={viewer.name}
        email={viewer.email}
        image={viewer.image}
        slug={viewer.slug}
        role={viewer.role}
        seed={viewer.id}
      />
    )
  }

  return (
    <Link
      href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      Iniciar sesión
    </Link>
  )
}

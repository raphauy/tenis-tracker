import Link from 'next/link'
import { Button } from '@/components/ui/button'

// CTAs compartidos entre la landing y el perfil público.
// `loggedInHref`: si el visitante está logueado, a dónde lleva su CTA (su perfil u onboarding).
// Si es null, es anónimo y se muestran los botones de registro/acceso.
export function CtaActions({ loggedInHref }: { loggedInHref: string | null }) {
  if (loggedInHref) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" nativeButton={false} render={<Link href={loggedInHref} />}>
          Ir a mis torneos
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button size="lg" nativeButton={false} render={<Link href="/login?mode=signup" />}>
        Registrarse
      </Button>
      <Button
        size="lg"
        variant="ghost"
        nativeButton={false}
        render={<Link href="/login" />}
      >
        Acceder
      </Button>
    </div>
  )
}

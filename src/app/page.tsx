import Link from 'next/link'
import { BarChart3Icon, ClipboardListIcon, Share2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimelinePreview } from '@/components/landing/timeline-preview'
import { auth } from '@/lib/auth'
import { getViewerChrome } from '@/services/user-service'

// `loggedInHref`: si el visitante está logueado, a dónde lleva su CTA (su perfil u onboarding).
// Si es null, es anónimo y se muestran los botones de registro/acceso.
function Actions({ loggedInHref }: { loggedInHref: string | null }) {
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

const FEATURES = [
  {
    icon: ClipboardListIcon,
    title: 'Registrá tus partidos',
    description: 'Ronda, rival, marcador y resultado.',
    soon: false,
  },
  {
    icon: BarChart3Icon,
    title: 'Estadísticas',
    description: 'Récord, títulos y rivales.',
    soon: true,
  },
  {
    icon: Share2Icon,
    title: 'Tu perfil de jugador',
    description: 'Una URL propia, pública o privada.',
    soon: false,
  },
]

export default async function Home() {
  // Landing visible también logueado. Si hay sesión, el CTA lleva a sus torneos
  // (o al onboarding si todavía no eligió slug).
  const session = await auth()
  let loggedInHref: string | null = null
  if (session?.user) {
    const me = await getViewerChrome(session.user.id)
    loggedInHref = me?.slug ? `/${me.slug}` : '/onboarding'
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-16 px-6 py-20 sm:py-28">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 text-center">
        <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">
          Tenis Tracker
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground text-balance">
          Una app simple para llevar el registro de tus torneos de tenis: partidos,
          resultados y rivales, todos en un mismo lugar.
        </p>
        <p className="max-w-sm text-sm text-muted-foreground/80 text-balance">
          Es gratis. Lo hice para mis propios torneos y lo dejo por si a alguien más le
          sirve.
          <span className="mt-1 block italic">
            —{' '}
            <Link
              href="/raphael-carvalho"
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              Raphael
            </Link>
          </span>
        </p>
        <Actions loggedInHref={loggedInHref} />
      </section>

      {/* Preview de la app */}
      <section className="w-full">
        <TimelinePreview />
      </section>

      {/* Qué hace */}
      <section className="grid w-full gap-8 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex flex-col items-center gap-2 text-center">
            <f.icon className="size-6 text-primary" />
            <h2 className="flex items-center gap-1.5 font-medium">
              {f.title}
              {f.soon && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                  pronto
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground text-balance">{f.description}</p>
          </div>
        ))}
      </section>

      {/* Cierre */}
      <section className="flex flex-col items-center gap-4">
        <Actions loggedInHref={loggedInHref} />
      </section>
    </main>
  )
}

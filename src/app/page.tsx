import Link from 'next/link'
import type { Metadata } from 'next'
import { BarChart3Icon, ClipboardListIcon, Share2Icon } from 'lucide-react'
import { TimelinePreview } from '@/components/landing/timeline-preview'
import { CtaActions } from '@/components/landing/cta-actions'
import { auth } from '@/lib/auth'
import { getViewerChrome } from '@/services/user-service'

// Title se cae al default del root layout (sin el sufijo del template).
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: '/' },
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
    soon: false,
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
        <CtaActions loggedInHref={loggedInHref} />
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
        <CtaActions loggedInHref={loggedInHref} />
      </section>
    </main>
  )
}

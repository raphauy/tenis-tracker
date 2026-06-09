import Link from 'next/link'
import type { Metadata } from 'next'
import {
  BarChart3Icon,
  ChevronRightIcon,
  ClipboardListIcon,
  Share2Icon,
  StarIcon,
} from 'lucide-react'
import { TimelinePreview } from '@/components/landing/timeline-preview'
import { BracketPreview } from '@/components/landing/bracket-preview'
import { CtaActions } from '@/components/landing/cta-actions'
import { LogoStacked } from '@/components/logo'
import { AccountMenu } from '@/components/account-menu'
import { Card } from '@/components/ui/card'
import { auth } from '@/lib/auth'
import { getViewerChrome } from '@/services/user-service'
import { listLiveTournaments } from '@/services/external-bracket-service'

// Sirve datos en vivo de los cuadros (torneos En curso) → dinámica.
export const dynamic = 'force-dynamic'

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
  },
  {
    icon: BarChart3Icon,
    title: 'Estadísticas',
    description: 'Récord, títulos y rivales.',
  },
  {
    icon: Share2Icon,
    title: 'Tu perfil de jugador',
    description: 'Una URL propia, pública o privada.',
  },
]

export default async function Home() {
  // Landing visible también logueado. Si hay sesión, el CTA lleva a sus torneos
  // (o al onboarding si todavía no eligió slug). La mayoría llega sin sesión.
  const [session, liveTournaments] = await Promise.all([auth(), listLiveTournaments()])
  let loggedInHref: string | null = null
  if (session?.user) {
    const me = await getViewerChrome(session.user.id)
    loggedInHref = me?.slug ? `/${me.slug}` : '/onboarding'
  }

  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center justify-end px-6 pt-6">
        <AccountMenu callbackUrl="/" />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-16 px-6 pb-16 pt-10 sm:gap-20 sm:pb-24 sm:pt-12">
        {/* Hero */}
      <section className="flex flex-col items-center gap-6 text-center">
        <h1 className="sr-only">Tenis Tracker</h1>
        <LogoStacked />
        <p className="max-w-lg text-lg text-muted-foreground text-balance">
          Anotá tus partidos de cada torneo y mirá los cuadros de cada competencia. Marcá
          como favoritos a tus rivales y amigos para seguirlos partido a partido.
        </p>
        <p className="max-w-sm text-sm text-muted-foreground/80 text-balance">
          Es gratis. Lo armé para seguir mis propios torneos y lo dejo por si a alguien más
          le sirve.
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

      {/* Cuadros — el eje nuevo, primero */}
      <section className="flex w-full flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Seguí los cuadros, en vivo
          </h2>
          <p className="max-w-md text-sm text-muted-foreground text-balance">
            Mirá el cuadro de cada torneo a medida que se juega. Marcá tus favoritos —vos,
            tus amigos, tus rivales— con la{' '}
            <StarIcon aria-hidden className="inline size-3.5 fill-current text-primary align-text-bottom" />{' '}
            y quedan resaltados en cada cuadro donde aparezcan.
          </p>
        </div>

        <BracketPreview />

        {liveTournaments.length > 0 ? (
          <div className="w-full max-w-md">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <span aria-hidden className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                En curso ahora
              </h3>
              <Link
                href="/cuadros"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <ul className="flex flex-col gap-2">
              {liveTournaments.map((t) => {
                const cats = t._count.brackets
                return (
                  <li key={t.id}>
                    <Link href={`/cuadros/${t.slug}`} className="block">
                      <Card className="flex-row items-center justify-between gap-3 bg-primary/[0.04] px-4 py-3 ring-primary/25 transition-colors hover:bg-primary/[0.08]">
                        <span className="min-w-0 truncate font-medium">{t.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          {cats > 0 && `${cats} categoría${cats === 1 ? '' : 's'}`}
                          <ChevronRightIcon aria-hidden className="size-4 text-primary/60" />
                        </span>
                      </Card>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <Link
            href="/cuadros"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver los cuadros →
          </Link>
        )}
      </section>

      {/* Seguí tus torneos — el tracking personal */}
      <section className="flex w-full flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Seguí tus torneos
          </h2>
          <p className="max-w-md text-sm text-muted-foreground text-balance">
            Cargá cada partido y mirá tu recorrido torneo por torneo, con tus estadísticas y
            tus rivales de siempre.
          </p>
        </div>

        <TimelinePreview />

        <div className="grid w-full gap-8 pt-2 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-2 text-center">
              <f.icon className="size-6 text-primary" />
              <h3 className="font-medium">{f.title}</h3>
              <p className="text-sm text-muted-foreground text-balance">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="flex flex-col items-center gap-4">
        <CtaActions loggedInHref={loggedInHref} />
      </section>
      </main>
    </>
  )
}

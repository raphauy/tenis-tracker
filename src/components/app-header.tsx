import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getViewerChrome } from '@/services/user-service'
import { Logo } from '@/components/logo'
import { UserAvatar } from '@/components/user-avatar'
import { buttonVariants } from '@/components/ui/button'
import { MainNavLinks, BottomNav } from '@/components/app-nav'
import { EmailBanner, type EmailBannerState } from '@/components/profile/email-banner'

// Shell de navegación global: header (logo + nav primaria desktop + cuenta), banner de
// email backup (global: acompaña al usuario logueado en toda vista con shell) y bottom nav
// fija en mobile. Conecta los dos ejes de la app (Cuadros ↔ Mis torneos) en toda página.
// Server component: lee sesión y viewer una sola vez. El layout que lo monta debe reservar
// el alto de la bottom nav con `pb-14 md:pb-0` en su wrapper.
export async function AppHeader({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const session = await auth()
  const viewer = session?.user?.id ? await getViewerChrome(session.user.id) : null
  const slug = viewer?.slug ?? null

  // Banner persistente del Email backup: hasta verificar, en toda vista con sesión.
  let banner: { state: EmailBannerState; email: string | null } | null = null
  if (viewer) {
    if (!viewer.email) banner = { state: 'no-email', email: null }
    else if (!viewer.emailVerifiedAt) banner = { state: 'pending-verify', email: viewer.email }
  }

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-[100rem] items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/" aria-label="Tenis Tracker">
              <Logo />
            </Link>
            <MainNavLinks slug={slug} isAuthenticated={!!viewer} />
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
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>
      {viewer && (
        <EmailBanner
          show={!!banner}
          state={banner?.state ?? 'no-email'}
          email={banner?.email ?? null}
          slug={slug}
        />
      )}
      <BottomNav slug={slug} isAuthenticated={!!viewer} />
    </>
  )
}

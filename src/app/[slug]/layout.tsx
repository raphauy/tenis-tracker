import { auth } from '@/lib/auth'
import { getEmailStatus, getUserAccessInfo } from '@/services/user-service'
import { AppHeader } from '@/components/app-header'
import { EmailBanner, type EmailBannerState } from '@/components/profile/email-banner'
import { NotifyNudge } from '@/components/profile/notify-nudge'
import { getNotifyNudgeState, type NudgeReason } from '@/services/notification-service'

// Layout del perfil público: shell de navegación global + banner de email backup y nudge
// de notificaciones SOLO cuando el viewer es el dueño del slug. Para anónimos o terceros,
// solo el shell (la decisión de "perfil privado" / "no existe" la toma cada page).
export default async function SlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  let banner: { state: EmailBannerState; email: string | null } | null = null
  let nudge: NudgeReason | null = null

  if (session?.user?.id) {
    const viewer = await getUserAccessInfo(session.user.id)
    if (viewer?.slug && viewer.slug === slug.toLowerCase()) {
      const status = await getEmailStatus(session.user.id)
      if (status) {
        if (!status.email) banner = { state: 'no-email', email: null }
        else if (!status.emailVerifiedAt) banner = { state: 'pending-verify', email: status.email }
      }
      nudge = await getNotifyNudgeState(session.user.id)
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col pb-14 md:pb-0">
      <AppHeader callbackUrl={`/${slug}`} />
      <EmailBanner
        show={!!banner}
        state={banner?.state ?? 'no-email'}
        email={banner?.email ?? null}
        slug={slug}
      />
      {nudge && <NotifyNudge slug={slug} reason={nudge} />}
      {children}
    </div>
  )
}

import { auth } from '@/lib/auth'
import { getUserAccessInfo } from '@/services/user-service'
import { AppHeader } from '@/components/app-header'
import { NotifyNudge } from '@/components/profile/notify-nudge'
import { getNotifyNudgeState, type NudgeReason } from '@/services/notification-service'

// Layout del perfil público: shell de navegación global (que ya incluye el banner de email
// backup) + nudge de notificaciones SOLO cuando el viewer es el dueño del slug. Para
// anónimos o terceros, solo el shell (la decisión de "perfil privado" / "no existe" la
// toma cada page).
export default async function SlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  let nudge: NudgeReason | null = null

  if (session?.user?.id) {
    const viewer = await getUserAccessInfo(session.user.id)
    if (viewer?.slug && viewer.slug === slug.toLowerCase()) {
      nudge = await getNotifyNudgeState(session.user.id)
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col pb-14 md:pb-0">
      <AppHeader callbackUrl={`/${slug}`} />
      {nudge && <NotifyNudge slug={slug} reason={nudge} />}
      {children}
    </div>
  )
}

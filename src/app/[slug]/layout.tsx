import { auth } from '@/lib/auth'
import { getEmailStatus, getUserAccessInfo } from '@/services/user-service'
import { EmailBanner, type EmailBannerState } from '@/components/profile/email-banner'

// Layout del perfil público. Inyecta el banner de email backup SOLO cuando el viewer
// es el dueño del slug Y todavía no tiene email verificado. Para anónimos o terceros,
// no se renderiza nada extra (la decisión de "perfil privado" / "no existe" la toma
// cada page; este layout es neutro a esos casos).
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

  if (session?.user?.id) {
    const viewer = await getUserAccessInfo(session.user.id)
    if (viewer?.slug && viewer.slug === slug.toLowerCase()) {
      const status = await getEmailStatus(session.user.id)
      if (status) {
        if (!status.email) banner = { state: 'no-email', email: null }
        else if (!status.emailVerifiedAt) banner = { state: 'pending-verify', email: status.email }
      }
    }
  }

  return (
    <>
      {banner && <EmailBanner state={banner.state} email={banner.email} />}
      {children}
    </>
  )
}

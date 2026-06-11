import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getEmailStatus, getViewerChrome } from '@/services/user-service'
import { AppHeader } from '@/components/app-header'
import { AdminNav } from '@/components/admin/admin-nav'
import { EmailBanner, type EmailBannerState } from '@/components/profile/email-banner'

// Cubre todo /admin/*: nunca se indexa.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// El acceso (solo SUPERADMIN) ya lo garantiza src/proxy.ts.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const viewer = session?.user ? await getViewerChrome(session.user.id) : null

  // Banner email backup: el admin es siempre dueño de sí mismo. Para Raphael, el seed
  // setea emailVerifiedAt → nunca se muestra. Para futuros superadmins entró por WA y
  // todavía no agregó email, sí se muestra (consistente con el resto de la app).
  let banner: { state: EmailBannerState; email: string | null } | null = null
  if (session?.user?.id) {
    const status = await getEmailStatus(session.user.id)
    if (status) {
      if (!status.email) banner = { state: 'no-email', email: null }
      else if (!status.emailVerifiedAt) banner = { state: 'pending-verify', email: status.email }
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col pb-14 md:pb-0">
      <AppHeader callbackUrl="/admin" />
      <AdminNav />
      <EmailBanner
        show={!!banner}
        state={banner?.state ?? 'no-email'}
        email={banner?.email ?? null}
        slug={viewer?.slug ?? null}
      />
      {children}
    </div>
  )
}

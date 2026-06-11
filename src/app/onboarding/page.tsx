import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth-helpers'
import { INVITE_COOKIE } from '@/lib/constants/invitation'
import { getViewerChrome } from '@/services/user-service'
import { getInvitationByToken } from '@/services/invitation-service'
import { OnboardingForm } from './onboarding-form'

export const metadata: Metadata = {
  title: 'Bienvenido',
  robots: { index: false, follow: false },
}

// Host visible en el prefijo del slug (sin protocolo), estilo GitHub.
function appHost(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export default async function OnboardingPage() {
  const user = await requireUser()
  const chrome = await getViewerChrome(user.id)

  // Ya completó el onboarding: no corresponde repetirlo.
  if (chrome?.slug) redirect(`/${chrome.slug}`)

  // Si entró por una invitación (/invitacion/[token]), prefijar nombre y email
  // con los datos que cargó el admin. La aceptación se marca en completeOnboarding.
  const inviteToken = (await cookies()).get(INVITE_COOKIE)?.value
  const invitation = inviteToken ? await getInvitationByToken(inviteToken) : null
  const invited =
    invitation && !invitation.acceptedAt && invitation.expiresAt > new Date() ? invitation : null

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <OnboardingForm
        initialName={chrome?.name ?? invited?.name ?? ''}
        initialEmail={invited?.email ?? ''}
        appHost={appHost()}
      />
    </div>
  )
}

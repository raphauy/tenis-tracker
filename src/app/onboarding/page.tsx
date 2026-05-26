import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth-helpers'
import { getViewerChrome } from '@/services/user-service'
import { OnboardingForm } from './onboarding-form'

// Host visible en el prefijo del slug (sin protocolo), estilo GitHub.
function appHost(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export default async function OnboardingPage() {
  const user = await requireUser()
  const chrome = await getViewerChrome(user.id)

  // Ya completó el onboarding: no corresponde repetirlo.
  if (chrome?.slug) redirect(`/${chrome.slug}`)

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <OnboardingForm initialName={chrome?.name ?? ''} appHost={appHost()} />
    </div>
  )
}

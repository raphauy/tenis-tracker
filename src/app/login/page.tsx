import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPostLoginUrl } from '@/lib/auth-redirect'
import { getUserAccessInfo } from '@/services/user-service'
import { INVITE_COOKIE } from '@/lib/constants/invitation'
import { getInvitationByToken } from '@/services/invitation-service'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Acceso',
  robots: { index: false, follow: false },
}

export default async function LoginPage() {
  // Si ya hay sesión, no mostrar el login: a Cuadros (u onboarding si todavía no tiene
  // slug — hay que resolverlo acá porque /cuadros es público y el proxy no lo fuerza).
  const session = await auth()
  if (session?.user) {
    const info = await getUserAccessInfo(session.user.id)
    redirect(info?.slug ? getPostLoginUrl() : '/onboarding')
  }

  // Si llegó desde una invitación (/invitacion/[token] dejó la cookie), el form
  // habla de "crear tu cuenta" en vez de "iniciar sesión".
  const inviteToken = (await cookies()).get(INVITE_COOKIE)?.value
  const inv = inviteToken ? await getInvitationByToken(inviteToken) : null
  const invitedName =
    inv && !inv.acceptedAt && inv.expiresAt > new Date() ? inv.name : null

  return (
    <div className="bg-background flex flex-1 items-center justify-center p-4">
      <Suspense fallback={<div>Cargando…</div>}>
        <LoginForm invitedName={invitedName} />
      </Suspense>
    </div>
  )
}

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPostLoginUrl } from '@/lib/auth-redirect'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  // Si ya hay sesión, no mostrar el login: mandar a donde corresponde por rol.
  const session = await auth()
  if (session?.user) {
    redirect(getPostLoginUrl(session.user.role))
  }

  return (
    <div className="bg-background flex flex-1 items-center justify-center p-4">
      <Suspense fallback={<div>Cargando…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}

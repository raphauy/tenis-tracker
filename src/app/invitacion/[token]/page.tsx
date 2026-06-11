import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { acceptInvitation, getInvitationByToken } from '@/services/invitation-service'
import { getUserAccessInfo } from '@/services/user-service'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { startInvitedSignup } from './actions'

export const metadata: Metadata = {
  title: 'Invitación',
  robots: { index: false, follow: false },
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  )
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Invitación no encontrada</CardTitle>
          <CardDescription>
            El link no es válido o fue reemplazado por un reenvío más reciente. Si te
            reenviaron la invitación, usá el link del último email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/" />}>
            Ir a Tenis Tracker
          </Button>
        </CardContent>
      </Shell>
    )
  }

  if (invitation.acceptedAt) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Invitación ya aceptada</CardTitle>
          <CardDescription>
            Esta invitación ya fue usada. Si la cuenta es tuya, entrá directo a la app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" nativeButton={false} render={<Link href="/login" />}>
            Iniciar sesión
          </Button>
        </CardContent>
      </Shell>
    )
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Invitación expirada</CardTitle>
          <CardDescription>
            Esta invitación venció. Pedile a {invitation.invitedBy.name ?? 'quien te invitó'} que
            te la reenvíe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/" />}>
            Ir a Tenis Tracker
          </Button>
        </CardContent>
      </Shell>
    )
  }

  // Visitante con sesión: ya está adentro de la app, no hay nada que registrar de nuevo.
  // Si ya completó el onboarding, la invitación se da por aceptada con su cuenta.
  const session = await auth()
  if (session?.user?.id) {
    const user = await getUserAccessInfo(session.user.id)
    if (user?.slug) {
      await acceptInvitation(token, session.user.id)
      return (
        <Shell>
          <CardHeader>
            <CardTitle>Ya tenés tu cuenta</CardTitle>
            <CardDescription>
              Ya estás registrado en Tenis Tracker, así que dimos la invitación por aceptada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" nativeButton={false} render={<Link href={`/${user.slug}`} />}>
              Ir a mis torneos
            </Button>
          </CardContent>
        </Shell>
      )
    }
  }

  const inviterName = invitation.invitedBy.name ?? 'Un admin'

  return (
    <Shell>
      <CardHeader>
        <CardTitle>¡Hola, {invitation.name}!</CardTitle>
        <CardDescription>
          <strong className="text-foreground font-medium">{inviterName}</strong> te invitó a
          Tenis Tracker: anotá tus partidos de cada torneo, mirá los cuadros de cada competencia
          y seguí a tus amigos y rivales partido a partido.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Crear la cuenta lleva un minuto: te identificás mandando un mensaje de WhatsApp y
          elegís tu link público. Sin contraseñas.
        </p>
        <form action={startInvitedSignup.bind(null, token)}>
          <Button type="submit" className="w-full">
            Aceptar y crear mi cuenta
          </Button>
        </form>
      </CardContent>
    </Shell>
  )
}

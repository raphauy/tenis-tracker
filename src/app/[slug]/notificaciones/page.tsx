import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveProfile } from '@/lib/profile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getNotificationSettings } from '@/services/notification-service'
import { NotificationsForm } from './notifications-form'

export const metadata: Metadata = {
  title: 'Notificaciones',
  robots: { index: false, follow: false },
}

export default async function NotificacionesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { owner, isOwner } = await resolveProfile(slug)
  if (!isOwner) notFound() // la configuración es solo del dueño

  const settings = await getNotificationSettings(owner.id)
  if (!settings) notFound()

  return (
    <main className="flex flex-1 justify-center px-4 py-10">
      <Card className="w-full max-w-lg self-start">
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
          <CardDescription>
            Elegí cómo querés enterarte de los resultados de tus favoritos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationsForm slug={slug} settings={settings} />
        </CardContent>
      </Card>
    </main>
  )
}

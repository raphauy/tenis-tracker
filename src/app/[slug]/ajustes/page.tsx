import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveProfile } from '@/lib/profile'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { AjustesForm } from './ajustes-form'

export const metadata: Metadata = {
  title: 'Ajustes',
  robots: { index: false, follow: false },
}

function appHost(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export default async function AjustesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { owner, viewer, isOwner } = await resolveProfile(slug)
  if (!isOwner) notFound() // los ajustes son solo del dueño

  return (
    <main className="flex flex-1 justify-center px-4 py-10">
      <Card className="w-full max-w-lg self-start">
        <CardHeader>
          <CardTitle>Ajustes</CardTitle>
          <CardDescription>Actualizá tu nombre, foto y la visibilidad de tu perfil.</CardDescription>
        </CardHeader>
        <CardContent>
          <AjustesForm
            slug={slug}
            appHost={appHost()}
            email={viewer?.email ?? ''}
            initialName={owner.name ?? ''}
            initialImage={owner.image}
            initialVisibility={owner.visibility}
          />
        </CardContent>
      </Card>
    </main>
  )
}

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { resolveProfile, getProfileBySlugCached } from '@/lib/profile'
import { getViewerChrome } from '@/services/user-service'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileNav } from '@/components/profile/profile-nav'
import { PrivateProfile } from '@/components/profile/private-profile'
import { CtaActions } from '@/components/landing/cta-actions'
import { Timeline } from './timeline'
import { TimelineSkeleton } from './timeline-skeleton'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const owner = await getProfileBySlugCached(slug)
  if (!owner) {
    return { title: 'Perfil no encontrado', robots: { index: false, follow: false } }
  }

  const name = owner.name ?? owner.slug ?? slug
  const isPrivate = owner.visibility === 'PRIVATE'
  const description = isPrivate
    ? `El perfil de ${name} es privado.`
    : `Registro de partidos de tenis de ${name} en Tenis Tracker — torneos, partidos, rivales y estadísticas.`
  const images = owner.image ? [{ url: owner.image, alt: name }] : undefined
  const url = `/${slug}`

  return {
    title: name, // el template del root le suma " · Tenis Tracker"
    description,
    alternates: { canonical: url },
    // Los perfiles privados no se indexan ni se siguen aunque el buscador conozca la URL.
    robots: isPrivate ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: 'profile', url, title: name, description, images },
    twitter: { card: 'summary', title: name, description, images: owner.image ? [owner.image] : undefined },
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { owner, viewer, isOwner } = await resolveProfile(slug)
  const viewerChrome = viewer ? await getViewerChrome(viewer.id) : null

  const isPrivate = owner.visibility === 'PRIVATE' && !isOwner

  // CTA del pie: anónimo → registrarse/acceder; logueado → su perfil (u onboarding si no tiene slug).
  const loggedInHref = viewerChrome ? (viewerChrome.slug ? `/${viewerChrome.slug}` : '/onboarding') : null

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
      <ProfileHeader
        ownerId={owner.id}
        ownerName={owner.name ?? owner.slug ?? ''}
        ownerImage={owner.image}
      />

      {isPrivate ? (
        <PrivateProfile name={owner.name ?? owner.slug ?? ''} />
      ) : (
        <>
          <ProfileNav slug={slug} className="mb-6" />
          <Suspense fallback={<TimelineSkeleton />}>
            <Timeline ownerId={owner.id} slug={slug} isOwner={isOwner} />
          </Suspense>
        </>
      )}

      {/* CTA de conversión: solo para visitantes. En tu propio perfil sería redundante (ya estás en "mis torneos"). */}
      {!isOwner && (
        <footer className="mt-16 border-t pt-8">
          <CtaActions loggedInHref={loggedInHref} />
        </footer>
      )}
    </main>
  )
}

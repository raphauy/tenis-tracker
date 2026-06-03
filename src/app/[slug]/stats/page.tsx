import { Suspense } from 'react'
import type { Metadata } from 'next'
import { resolveProfile, getProfileBySlugCached } from '@/lib/profile'
import { getViewerChrome } from '@/services/user-service'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const owner = await getProfileBySlugCached(slug)
  if (!owner) return { title: 'Estadísticas', robots: { index: false, follow: false } }

  const name = owner.name ?? owner.slug ?? slug
  const isPrivate = owner.visibility === 'PRIVATE'
  const description = isPrivate
    ? `El perfil de ${name} es privado.`
    : `Estadísticas de ${name}: récord W/L, títulos, mejores categorías y rivales frecuentes.`
  const images = owner.image ? [{ url: owner.image, alt: name }] : undefined
  const url = `/${slug}/stats`

  return {
    title: `Estadísticas de ${name}`,
    description,
    alternates: { canonical: url },
    robots: isPrivate ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: 'profile', url, title: `Estadísticas de ${name}`, description, images },
    twitter: { card: 'summary', title: `Estadísticas de ${name}`, description, images: owner.image ? [owner.image] : undefined },
  }
}
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileNav } from '@/components/profile/profile-nav'
import { PrivateProfile } from '@/components/profile/private-profile'
import { CtaActions } from '@/components/landing/cta-actions'
import { Stats } from './stats'
import { StatsSkeleton } from './stats-skeleton'

export default async function StatsPage({ params }: { params: Promise<{ slug: string }> }) {
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
        ownerSlug={slug}
        ownerImage={owner.image}
        isOwner={isOwner}
        viewer={viewerChrome}
      />

      {isPrivate ? (
        <PrivateProfile name={owner.name ?? owner.slug ?? ''} />
      ) : (
        <>
          <ProfileNav slug={slug} className="mb-6" />
          <Suspense fallback={<StatsSkeleton />}>
            <Stats ownerId={owner.id} isOwner={isOwner} slug={slug} />
          </Suspense>
        </>
      )}

      <footer className="mt-16 border-t pt-8">
        <CtaActions loggedInHref={loggedInHref} />
      </footer>
    </main>
  )
}

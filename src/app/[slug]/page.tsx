import { Suspense } from 'react'
import type { Metadata } from 'next'
import { resolveProfile, getProfileBySlugCached } from '@/lib/profile'
import { getViewerChrome } from '@/services/user-service'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileNav } from '@/components/profile/profile-nav'
import { PrivateProfile } from '@/components/profile/private-profile'
import { Timeline } from './timeline'
import { TimelineSkeleton } from './timeline-skeleton'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const owner = await getProfileBySlugCached(slug)
  return { title: owner?.name ? `${owner.name} · Tenis Tracker` : 'Tenis Tracker' }
}

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { owner, viewer, isOwner } = await resolveProfile(slug)
  const viewerChrome = viewer ? await getViewerChrome(viewer.id) : null

  const isPrivate = owner.visibility === 'PRIVATE' && !isOwner

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <ProfileHeader
        ownerName={owner.name ?? owner.slug ?? ''}
        ownerSlug={slug}
        viewer={viewerChrome}
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
    </main>
  )
}

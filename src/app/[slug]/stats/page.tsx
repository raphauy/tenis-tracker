import { resolveProfile } from '@/lib/profile'
import { getViewerChrome } from '@/services/user-service'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileNav } from '@/components/profile/profile-nav'
import { PrivateProfile } from '@/components/profile/private-profile'

export default async function StatsPage({ params }: { params: Promise<{ slug: string }> }) {
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
          <div className="rounded-xl border border-dashed py-16 text-center">
            <p className="text-muted-foreground">Estadísticas en desarrollo.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pronto vas a ver acá tu récord, títulos y head-to-head.
            </p>
          </div>
        </>
      )}
    </main>
  )
}

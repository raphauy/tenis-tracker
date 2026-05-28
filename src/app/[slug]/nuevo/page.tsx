import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveProfile } from '@/lib/profile'

export const metadata: Metadata = {
  title: 'Cargar torneo',
  robots: { index: false, follow: false },
}
import { getTournamentsForUser } from '@/services/tournament-service'
import { getVenuesForUser } from '@/services/venue-service'
import { getCategoriesForUser } from '@/services/category-service'
import { getPlayersForUser } from '@/services/player-service'
import { buttonVariants } from '@/components/ui/button'
import { LoadWizard } from './load-wizard'

export default async function NuevoTorneoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { owner, isOwner } = await resolveProfile(slug)
  if (!isOwner) notFound() // cargar es solo del dueño

  const u = { id: owner.id, role: owner.role }
  const [tournaments, venues, categories, players] = await Promise.all([
    getTournamentsForUser(u),
    getVenuesForUser(u),
    getCategoriesForUser(u),
    getPlayersForUser(owner.id),
  ])

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo torneo</h1>
        <Link href={`/${slug}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Volver
        </Link>
      </header>

      <LoadWizard
        tournaments={tournaments.map((t) => ({ id: t.id, label: t.name }))}
        venues={venues.map((v) => ({ id: v.id, label: v.name }))}
        categories={categories.map((c) => ({ id: c.id, label: c.name }))}
        players={players.map((p) => ({ id: p.id, label: p.name, deletable: p.deletable }))}
      />
    </main>
  )
}

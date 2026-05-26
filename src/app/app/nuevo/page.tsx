import Link from 'next/link'
import { requireUser } from '@/lib/auth-helpers'
import { getTournamentsForUser } from '@/services/tournament-service'
import { getVenuesForUser } from '@/services/venue-service'
import { getCategoriesForUser } from '@/services/category-service'
import { getPlayersForUser } from '@/services/player-service'
import { buttonVariants } from '@/components/ui/button'
import { LoadWizard } from './load-wizard'

export default async function NuevoTorneoPage() {
  const user = await requireUser()
  const [tournaments, venues, categories, players] = await Promise.all([
    getTournamentsForUser(user),
    getVenuesForUser(user),
    getCategoriesForUser(user),
    getPlayersForUser(user.id),
  ])

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo torneo</h1>
        <Link href="/app" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
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

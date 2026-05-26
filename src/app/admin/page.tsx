import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getPendingVenues,
  getApprovedVenues,
} from '@/services/venue-service'
import {
  getPendingCategories,
  getApprovedCategories,
} from '@/services/category-service'
import {
  getPendingTournaments,
  getApprovedTournaments,
} from '@/services/tournament-service'
import { getPlayersAdmin } from '@/services/player-service'
import { AdminPanel } from './admin-panel'

export const metadata = { title: 'Panel de administración · Tenis Tracker' }

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  )
}

async function PanelData() {
  const [venues, categories, tournaments, players, approvedVenues, approvedCategories, approvedTournaments] =
    await Promise.all([
      getPendingVenues(),
      getPendingCategories(),
      getPendingTournaments(),
      getPlayersAdmin(),
      getApprovedVenues(),
      getApprovedCategories(),
      getApprovedTournaments(),
    ])

  return (
    <AdminPanel
      venues={venues}
      categories={categories}
      tournaments={tournaments}
      players={players}
      approvedVenues={approvedVenues}
      approvedCategories={approvedCategories}
      approvedTournaments={approvedTournaments}
    />
  )
}

export default function AdminHomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Cola de curado</h1>
        <p className="text-sm text-muted-foreground">
          Aprobá, editá, fusioná duplicados y eliminá entradas del catálogo compartido.
        </p>
      </header>
      <Suspense fallback={<PanelSkeleton />}>
        <PanelData />
      </Suspense>
    </main>
  )
}

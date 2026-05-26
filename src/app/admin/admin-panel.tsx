'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { CatalogQueue } from './catalog-queue'
import { PlayersTab } from './players-tab'
import type { CatalogPending, CatalogOption } from '@/services/venue-service'
import type { TournamentPending } from '@/services/tournament-service'
import type { PlayerAdmin } from '@/services/player-service'

type Props = {
  venues: CatalogPending[]
  categories: CatalogPending[]
  tournaments: TournamentPending[]
  players: PlayerAdmin[]
  approvedVenues: CatalogOption[]
  approvedCategories: CatalogOption[]
  approvedTournaments: CatalogOption[]
}

function CountBadge({ n }: { n: number }) {
  if (n === 0) return null
  return (
    <Badge variant="secondary" className="ml-1">
      {n}
    </Badge>
  )
}

export function AdminPanel({
  venues,
  categories,
  tournaments,
  players,
  approvedVenues,
  approvedCategories,
  approvedTournaments,
}: Props) {
  return (
    <Tabs defaultValue="venues" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="venues">
          Sedes <CountBadge n={venues.length} />
        </TabsTrigger>
        <TabsTrigger value="categories">
          Categorías <CountBadge n={categories.length} />
        </TabsTrigger>
        <TabsTrigger value="tournaments">
          Torneos <CountBadge n={tournaments.length} />
        </TabsTrigger>
        <TabsTrigger value="players">Jugadores</TabsTrigger>
      </TabsList>

      <TabsContent value="venues" className="mt-4">
        <CatalogQueue kind="venue" items={venues} mergeTargets={approvedVenues} />
      </TabsContent>
      <TabsContent value="categories" className="mt-4">
        <CatalogQueue kind="category" items={categories} mergeTargets={approvedCategories} />
      </TabsContent>
      <TabsContent value="tournaments" className="mt-4">
        <CatalogQueue
          kind="tournament"
          items={tournaments}
          mergeTargets={approvedTournaments}
          venueOptions={approvedVenues}
        />
      </TabsContent>
      <TabsContent value="players" className="mt-4">
        <PlayersTab players={players} />
      </TabsContent>
    </Tabs>
  )
}

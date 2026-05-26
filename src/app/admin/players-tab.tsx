'use client'

import * as React from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MergeDialog } from './merge-dialog'
import { EditNameDialog, DeleteButton } from './catalog-queue'
import type { PlayerAdmin } from '@/services/player-service'

export function PlayersTab({ players }: { players: PlayerAdmin[] }) {
  const [query, setQuery] = React.useState('')
  const lower = query.trim().toLowerCase()
  const filtered = React.useMemo(
    () => (lower ? players.filter((p) => p.name.toLowerCase().includes(lower)) : players),
    [players, lower]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar jugador…"
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin jugadores.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {filtered.map((player) => (
            <li key={player.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{player.name}</p>
                {player.matchCount > 0 && (
                  <Badge variant="outline" className="mt-0.5">
                    {player.matchCount} partido{player.matchCount === 1 ? '' : 's'}
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <EditNameDialog kind="player" id={player.id} current={player.name} />
                <MergeDialog
                  kind="player"
                  duplicate={{ id: player.id, name: player.name }}
                  targets={players
                    .filter((p) => p.id !== player.id)
                    .map((p) => ({ id: p.id, label: p.name }))}
                />
                <DeleteButton kind="player" id={player.id} name={player.name} disabled={player.matchCount > 0} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { requireUser } from '@/lib/auth-helpers'
import { getEntriesForUser } from '@/services/entry-service'
import { deriveTournamentResult } from '@/lib/tennis/derive'
import { parseSets } from '@/lib/tennis/set-score'
import { TimelineList, type TimelineEntry } from './timeline-list'

// Línea de tiempo de Participaciones del usuario (más reciente primero), con resultado derivado.
// Serializa todo y delega el filtrado/render al cliente (dataset chico → búsqueda instantánea).
export async function Timeline() {
  const user = await requireUser()
  const entries = await getEntriesForUser(user.id)

  const serialized: TimelineEntry[] = entries.map((entry) => ({
    id: entry.id,
    tournamentName: entry.tournament.name,
    venueName: entry.tournament.venue.name,
    categoryName: entry.category.name,
    year: entry.tournament.startDate ? entry.tournament.startDate.getUTCFullYear() : null,
    startDate: entry.tournament.startDate ? entry.tournament.startDate.toISOString() : null,
    result: deriveTournamentResult(entry.matches),
    matches: entry.matches.map((m) => ({
      id: m.id,
      round: m.round,
      type: m.type,
      status: m.status,
      winner: m.winner,
      opponentName: m.opponent?.name ?? null,
      sets: parseSets(m.sets),
    })),
  }))

  return <TimelineList entries={serialized} />
}

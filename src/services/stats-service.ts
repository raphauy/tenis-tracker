import { getEntriesForUser } from '@/services/entry-service'
import { parseSets } from '@/lib/tennis/set-score'
import { computeCareerStats, type CareerStats, type StatEntry } from '@/lib/tennis/stats'

// Estadísticas de carrera del dueño del Perfil. Reusa la query de la timeline
// (getEntriesForUser ya trae tournament + category + matches.opponent) y delega
// el cálculo a la lógica pura de @/lib/tennis/stats.
export async function getCareerStats(userId: string): Promise<CareerStats> {
  const entries = await getEntriesForUser(userId)

  const statEntries: StatEntry[] = entries.map((entry) => {
    // Año: del torneo (startDate) o, si falta, del alta de la participación.
    const yearSource = entry.tournament.startDate ?? entry.createdAt
    return {
      year: yearSource.getUTCFullYear(),
      categoryName: entry.category.name,
      tournamentName: entry.tournament.name,
      startDate: entry.tournament.startDate ? entry.tournament.startDate.toISOString() : null,
      matches: entry.matches.map((m) => ({
        round: m.round,
        type: m.type,
        status: m.status,
        winner: m.winner,
        opponentName: m.opponent?.name ?? null,
        sets: parseSets(m.sets),
      })),
    }
  })

  return computeCareerStats(statEntries)
}

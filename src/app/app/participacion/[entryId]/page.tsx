import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth-helpers'
import { getEntryById } from '@/services/entry-service'
import { getPlayersForUser } from '@/services/player-service'
import { deriveTournamentResult } from '@/lib/tennis/derive'
import { parseSets } from '@/lib/tennis/set-score'
import { buttonVariants } from '@/components/ui/button'
import { EntryDetail, type SerializedMatch } from './entry-detail'

function formatMonthYear(date: Date | null): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export default async function ParticipacionPage({
  params,
}: {
  params: Promise<{ entryId: string }>
}) {
  const { entryId } = await params
  const user = await requireUser()

  const [entry, players] = await Promise.all([
    getEntryById(entryId, user.id),
    getPlayersForUser(user.id),
  ])
  if (!entry) notFound()

  const result = deriveTournamentResult(entry.matches)
  const matches: SerializedMatch[] = entry.matches.map((m) => ({
    id: m.id,
    round: m.round,
    type: m.type,
    status: m.status,
    winner: m.winner,
    retiredBy: m.retiredBy,
    opponentId: m.opponentId,
    opponentName: m.opponent?.name ?? null,
    sets: parseSets(m.sets),
  }))

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="mb-6">
        <Link href="/app" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          ← Volver a mis torneos
        </Link>
      </div>

      <EntryDetail
        entryId={entry.id}
        tournamentName={entry.tournament.name}
        categoryName={entry.category.name}
        venueName={entry.tournament.venue.name}
        monthYear={formatMonthYear(entry.tournament.startDate)}
        result={result}
        matches={matches}
        players={players.map((p) => ({ id: p.id, label: p.name, deletable: p.deletable }))}
      />
    </main>
  )
}

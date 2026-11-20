'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronDownIcon, ChevronRightIcon, SwordsIcon } from 'lucide-react'
import { MatchSide } from '@prisma/client'
import {
  orientScore,
  type PlayerMatch,
  type PlayerResult,
} from '@/lib/cuadros/player-search'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WinLoss } from '@/components/match/score-display'
import { cn } from '@/lib/utils'
import { ScoreSets } from './bracket-match'

function formatMonthYear(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso)
  )
}

function matchesLabel(n: number): string {
  return `${n} ${n === 1 ? 'partido' : 'partidos'}`
}

function tournamentsLabel(n: number): string {
  return `${n} ${n === 1 ? 'torneo' : 'torneos'}`
}

function formatPct(pct: number | null): string {
  return pct === null ? '—' : `${Math.round(pct * 100)}%`
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    // dt antes que dd (HTML válido); el valor se muestra arriba con flex-col-reverse.
    <div className="flex flex-col-reverse items-center gap-0.5">
      <dt className="text-[10px] font-normal text-muted-foreground">{label}</dt>
      <dd className="font-heading text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

// Resumen del jugador en la fila colapsada: mismas métricas que las Estadísticas del Perfil.
function PlayerStats({ player, className }: { player: PlayerResult; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-5 gap-x-3', className)}>
      <Stat value={`${player.wins}-${player.losses}`} label="G-P" />
      <Stat value={formatPct(player.winPct)} label="Win rate" />
      <Stat value={String(player.titles)} label="Títulos" />
      <Stat value={String(player.finals)} label="Finales" />
      <Stat value={String(player.semis)} label="Semis" />
    </dl>
  )
}

// Desenlace del partido desde el jugador buscado: marcador (sus games primero), W.O.,
// retiro o pendiente.
function Outcome({ match }: { match: PlayerMatch }) {
  if (match.status === 'pending') {
    return <span className="text-xs text-muted-foreground">Pendiente</span>
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      {match.outcome === 'walkover' && (
        <Badge variant="outline" className="px-1 py-0 text-[10px] leading-tight">
          W.O.
        </Badge>
      )}
      {match.outcome === 'retiro' && (
        <Badge variant="outline" className="px-1 py-0 text-[10px] leading-tight">
          Ret.
        </Badge>
      )}
      {match.score ? (
        <ScoreSets score={orientScore(match.score, match.won)} />
      ) : (
        match.outcome === 'walkover' && <span>Sin jugar</span>
      )}
    </span>
  )
}

function Chip({ won }: { won: boolean | null }) {
  return (
    <WinLoss
      winner={won === null ? null : won ? MatchSide.ME : MatchSide.OPPONENT}
      className="mt-0.5 shrink-0"
    />
  )
}

// Un partido del jugador. Si se cruzó más de una vez con ese rival, debajo va la línea
// "N enfrentamientos · G-P" que despliega el historial entre los dos.
function MatchRow({ match, history }: { match: PlayerMatch; history: PlayerMatch[] }) {
  const [open, setOpen] = React.useState(false)
  const h2h = match.h2h

  return (
    <li className="flex flex-col gap-1.5 border-t border-border/60 py-2 first:border-t-0">
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className="w-20 shrink-0 pt-0.5 text-xs text-muted-foreground">
          {match.roundLabel}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate">vs. {match.opponentName}</span>
          <Outcome match={match} />
        </div>
        <Chip won={match.won} />
      </div>

      {h2h && (
        <div className="pl-[5.75rem]">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="-ml-2 text-muted-foreground"
          >
            <SwordsIcon />
            {h2h.total} enfrentamientos ·{' '}
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {h2h.wins}-{h2h.losses}
            </span>
            {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </Button>

          {open && (
            <ul className="mt-1 flex flex-col rounded-lg border bg-muted/30 px-3">
              {history.map((h) => (
                <li
                  key={h.key}
                  className="flex items-start justify-between gap-3 border-t py-2 first:border-t-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Link
                      href={`/cuadros/${h.tournamentSlug}/${h.categorySlug}`}
                      className="truncate text-xs no-underline! hover:underline!"
                    >
                      {h.tournamentName} · {h.categoryName}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {h.roundLabel}
                      {h.startDate && ` · ${formatMonthYear(h.startDate)}`}
                    </span>
                    <Outcome match={h} />
                  </div>
                  <Chip won={h.won} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

type TournamentGroup = { key: string; first: PlayerMatch; matches: PlayerMatch[] }

// Los partidos ya vienen ordenados por torneo: se agrupan los consecutivos del mismo cuadro
// para no repetir el nombre en cada fila y poder distinguir, por la fecha, ediciones que
// se llaman igual.
function groupByTournament(matches: PlayerMatch[]): TournamentGroup[] {
  const groups: TournamentGroup[] = []
  for (const m of matches) {
    const key = `${m.tournamentSlug}/${m.categorySlug}`
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.matches.push(m)
    else groups.push({ key, first: m, matches: [m] })
  }
  return groups
}

// Resultados del buscador de jugador: un accordion por jugador encontrado, con todos sus
// partidos en los cuadros (más reciente primero).
export function PlayerResultsList({ players }: { players: PlayerResult[] }) {
  return (
    <Accordion
      className="flex flex-col gap-3"
      // Varios jugadores abiertos a la vez, para poder compararlos.
      multiple
      // Con un solo jugador no hay nada que elegir: va abierto.
      defaultValue={players.length === 1 ? [players[0].nameKey] : []}
    >
      {players.map((player) => (
        <AccordionItem
          key={player.nameKey}
          value={player.nameKey}
          className="rounded-xl border bg-card px-4 shadow-sm"
        >
          <AccordionTrigger className="py-3.5 hover:no-underline">
            {/* Desktop: stats a la derecha del nombre. Mobile: debajo, a todo el ancho. */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 pr-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">{player.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {matchesLabel(player.matches.length)} · {tournamentsLabel(player.tournaments)}
                </span>
              </div>
              <PlayerStats player={player} className="sm:w-80 sm:shrink-0" />
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-4">
              {groupByTournament(player.matches).map((group) => (
                <section key={group.key}>
                  <div className="flex items-baseline justify-between gap-3 border-b pb-1.5">
                    <Link
                      href={`/cuadros/${group.first.tournamentSlug}/${group.first.categorySlug}`}
                      className="min-w-0 truncate text-xs font-medium no-underline! hover:underline!"
                    >
                      {group.first.tournamentName} · {group.first.categoryName}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatMonthYear(group.first.startDate)}
                    </span>
                  </div>
                  <ul className="flex flex-col">
                    {group.matches.map((m) => (
                      <MatchRow
                        key={m.key}
                        match={m}
                        history={player.matches.filter((x) => x.opponentKey === m.opponentKey)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

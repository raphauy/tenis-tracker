'use client'

import * as React from 'react'
import Link from 'next/link'
import { SearchIcon, XIcon } from 'lucide-react'
import { Round, MatchType, MatchStatus, MatchSide } from '@prisma/client'
import type { EntryResult } from '@/lib/tennis/derive'
import { ROUND_ORDER } from '@/lib/tennis/derive'
import { ROUND_LABELS } from '@/lib/tennis/labels'
import type { SetScore } from '@/lib/tennis/set-score'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { ResultBadge } from '@/components/match/result-badge'
import { ScoreDisplay } from '@/components/match/score-display'
import { CategoryBadge } from '@/components/match/category-badge'

export type TimelineEntry = {
  id: string
  tournamentName: string
  venueName: string
  categoryName: string
  year: number | null
  startDate: string | null
  result: EntryResult
  matches: {
    id: string
    round: Round
    type: MatchType
    status: MatchStatus
    winner: MatchSide | null
    opponentName: string | null
    sets: SetScore[] | null
  }[]
}

const ALL = 'all'

// Filtro de Resultado oculto hasta decidir si va. Poner en true para mostrarlo de nuevo.
const SHOW_RESULT_FILTER = false

const RESULT_LABELS: Record<EntryResult['kind'], string> = {
  CAMPEON: 'Campeón',
  FINALISTA: 'Finalista',
  SEMIFINALISTA: 'Semifinalista',
  ELIMINADO: 'Eliminado',
  EN_CURSO: 'En curso',
}
const RESULT_ORDER: EntryResult['kind'][] = [
  'CAMPEON',
  'FINALISTA',
  'SEMIFINALISTA',
  'ELIMINADO',
  'EN_CURSO',
]

function formatMonthYear(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso)
  )
}

function sortByRound<T extends { round: Round }>(matches: T[]): T[] {
  return [...matches].sort((a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round))
}

// Normaliza para buscar sin distinguir tildes ni ñ (Núñez ≈ nunez, café ≈ cafe).
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function TimelineList({
  entries,
  slug,
  isOwner,
}: {
  entries: TimelineEntry[]
  slug: string
  isOwner: boolean
}) {
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState<string>(ALL)
  const [result, setResult] = React.useState<string>(ALL)
  const [year, setYear] = React.useState<string>(ALL)

  // Opciones de filtro derivadas de lo que el usuario realmente jugó.
  const categories = React.useMemo(
    () => [...new Set(entries.map((e) => e.categoryName))].sort(),
    [entries]
  )
  const years = React.useMemo(
    () =>
      [...new Set(entries.map((e) => e.year).filter((y): y is number => y != null))].sort(
        (a, b) => b - a
      ),
    [entries]
  )
  const results = React.useMemo(() => {
    const present = new Set(entries.map((e) => e.result.kind))
    return RESULT_ORDER.filter((k) => present.has(k))
  }, [entries])

  const q = normalize(search.trim())
  const filtered = React.useMemo(() => {
    return entries.filter((e) => {
      if (category !== ALL && e.categoryName !== category) return false
      if (result !== ALL && e.result.kind !== result) return false
      if (year !== ALL && String(e.year) !== year) return false
      if (q) {
        const haystack = normalize(
          [
            e.tournamentName,
            e.venueName,
            e.categoryName,
            ...e.matches.map((m) => m.opponentName ?? ''),
          ].join(' ')
        )
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [entries, category, result, year, q])

  const hasFilters = !!q || category !== ALL || result !== ALL || year !== ALL
  function clearFilters() {
    setSearch('')
    setCategory(ALL)
    setResult(ALL)
    setYear(ALL)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-col gap-2">
        {/* Buscador + CTA: el botón conserva su tamaño, el buscador ocupa el resto del ancho. */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar torneo, sede, rival o categoría…"
              className="px-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2 inline-flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>
          {isOwner && (
            <Link
              href={`/${slug}/nuevo`}
              className={cn(buttonVariants({ variant: 'default' }), 'shrink-0')}
            >
              + Nuevo torneo
            </Link>
          )}
        </div>

        {/* Selectores: se estiran para llenar el ancho; envuelven en pantallas chicas. */}
        <div className="flex flex-wrap items-center gap-2">
          {years.length > 0 && (
            <Select
              value={year}
              onValueChange={(v) => setYear(v as string)}
              items={{ [ALL]: 'Año', ...Object.fromEntries(years.map((y) => [String(y), String(y)])) }}
            >
              <SelectTrigger className="min-w-28 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={category}
            onValueChange={(v) => setCategory(v as string)}
            items={{ [ALL]: 'Categoría', ...Object.fromEntries(categories.map((c) => [c, c])) }}
          >
            <SelectTrigger className="min-w-28 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro de Resultado: oculto de la UI por ahora (sin decidir). La lógica de
              filtrado por `result` sigue activa; flipear SHOW_RESULT_FILTER para mostrarlo. */}
          {SHOW_RESULT_FILTER && (
            <Select
              value={result}
              onValueChange={(v) => setResult(v as string)}
              items={{ [ALL]: 'Resultado', ...Object.fromEntries(results.map((k) => [k, RESULT_LABELS[k]])) }}
            >
              <SelectTrigger className="min-w-28 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {results.map((k) => (
                  <SelectItem key={k} value={k}>
                    {RESULT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex w-fit cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3.5" /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Lista */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          {isOwner
            ? 'Todavía no cargaste ningún torneo. Usá “+ Nuevo torneo” para empezar.'
            : 'Todavía no hay torneos cargados.'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          Ningún torneo coincide con el filtro.
        </div>
      ) : (
        <Accordion className="flex flex-col gap-3">
          {filtered.map((entry) => {
            const matches = sortByRound(entry.matches)
            return (
              <AccordionItem
                key={entry.id}
                value={entry.id}
                className="rounded-xl border bg-card px-4 shadow-sm"
              >
                <AccordionTrigger className="py-3.5">
                  <div className="flex flex-1 flex-col gap-4 pr-8">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.tournamentName}</span>
                      <ResultBadge result={entry.result} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {entry.startDate && `${formatMonthYear(entry.startDate)} · `}
                      {entry.venueName}
                    </span>
                  </div>
                  <CategoryBadge name={entry.categoryName} className="absolute right-0 bottom-3.5" />
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2">
                    {matches.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-3 border-t py-2 text-sm first:border-t-0"
                      >
                        <span className="w-28 shrink-0 text-muted-foreground">
                          {ROUND_LABELS[m.round]}
                        </span>
                        <span className="flex-1 truncate">{m.opponentName ?? '—'}</span>
                        <ScoreDisplay type={m.type} status={m.status} winner={m.winner} sets={m.sets} />
                      </div>
                    ))}
                    {isOwner && (
                      <div className="pt-1">
                        <Link
                          href={`/${slug}/participacion/${entry.id}`}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          Ver detalle / editar
                        </Link>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}

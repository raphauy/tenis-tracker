'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import { Round, MatchType, MatchStatus, MatchSide } from '@prisma/client'
import type { MatchPayload } from '@/lib/validations/match'
import type { SetScore } from '@/lib/tennis/set-score'
import type { EntryResult } from '@/lib/tennis/derive'
import { ROUND_ORDER } from '@/lib/tennis/derive'
import { ROUND_LABELS } from '@/lib/tennis/labels'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { ResultBadge } from '@/components/match/result-badge'
import { ScoreDisplay } from '@/components/match/score-display'
import { CategoryBadge } from '@/components/match/category-badge'
import { MatchForm, type MatchFormInitial } from '@/components/match/match-form'
import type { ComboOption } from '@/components/catalog/catalog-combobox'
import {
  addMatchAction,
  updateMatchAction,
  deleteMatchAction,
  deleteEntryAction,
  createPlayerAction,
  deletePlayerAction,
} from '@/app/app/actions'

export type SerializedMatch = {
  id: string
  round: Round
  type: MatchType
  status: MatchStatus
  winner: MatchSide | null
  retiredBy: MatchSide | null
  opponentId: string | null
  opponentName: string | null
  sets: SetScore[] | null
}

type Props = {
  entryId: string
  tournamentName: string
  categoryName: string
  venueName: string
  monthYear: string
  result: EntryResult
  matches: SerializedMatch[]
  players: ComboOption[]
}

async function createPlayer(name: string): Promise<ComboOption | null> {
  const res = await createPlayerAction(name)
  if (!res.success || !res.data) {
    toast.error(res.success ? 'No se pudo crear el jugador' : res.error)
    return null
  }
  return { id: res.data.id, label: res.data.name, deletable: true }
}

async function deletePlayer(id: string): Promise<boolean> {
  const res = await deletePlayerAction(id)
  if (!res.success) {
    toast.error(res.error)
    return false
  }
  toast.success('Jugador borrado')
  return true
}

export function EntryDetail({
  entryId,
  tournamentName,
  categoryName,
  venueName,
  monthYear,
  result,
  matches,
  players,
}: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SerializedMatch | null>(null)
  const [deletingMatch, setDeletingMatch] = React.useState<SerializedMatch | null>(null)
  const [deleteEntryOpen, setDeleteEntryOpen] = React.useState(false)

  const usedRounds = matches.map((m) => m.round)
  const sorted = [...matches].sort(
    (a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round)
  )

  async function handleAdd(payload: MatchPayload) {
    const res = await addMatchAction({ entryId, match: payload })
    if (res.success) {
      toast.success('Partido agregado')
      setAddOpen(false)
      router.refresh()
    }
    return res
  }

  async function handleEdit(payload: MatchPayload) {
    if (!editing) return { success: false as const, error: 'Sin partido' }
    const res = await updateMatchAction({ ...payload, id: editing.id })
    if (res.success) {
      toast.success('Partido actualizado')
      setEditing(null)
      router.refresh()
    }
    return res
  }

  async function confirmDeleteMatch() {
    if (!deletingMatch) return
    const res = await deleteMatchAction(deletingMatch.id)
    if (res.success) {
      toast.success('Partido borrado')
      setDeletingMatch(null)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  async function confirmDeleteEntry() {
    const res = await deleteEntryAction(entryId)
    if (res.success) {
      toast.success('Participación borrada')
      router.push('/app')
    } else {
      toast.error(res.error)
    }
  }

  function toInitial(m: SerializedMatch): MatchFormInitial {
    return {
      round: m.round,
      type: m.type,
      opponentId: m.opponentId,
      status: m.status,
      sets: m.sets,
      retiredBy: m.retiredBy,
      walkoverWinner: m.type === MatchType.WALKOVER ? m.winner : null,
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{tournamentName}</h1>
          <ResultBadge result={result} />
          <CategoryBadge name={categoryName} />
        </div>
        <p className="text-sm text-muted-foreground">
          {monthYear && `${monthYear} · `}
          {venueName}
        </p>
      </header>

      <section className="flex flex-col gap-1 rounded-xl border bg-card shadow-sm">
        {sorted.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Todavía no cargaste partidos.
          </p>
        )}
        {sorted.map((m) => (
          <div
            key={m.id}
            className="group flex min-h-11 items-center justify-between gap-3 border-b px-4 py-1.5 text-sm last:border-b-0"
          >
            <span className="w-24 shrink-0 text-muted-foreground">{ROUND_LABELS[m.round]}</span>
            <span className="flex-1 truncate">{m.opponentName ?? '—'}</span>
            <div className="hidden shrink-0 gap-0.5 group-hover:flex group-focus-within:flex">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Editar partido"
                title="Editar"
                onClick={() => setEditing(m)}
              >
                <PencilIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive"
                aria-label="Borrar partido"
                title="Borrar"
                onClick={() => setDeletingMatch(m)}
              >
                <Trash2Icon />
              </Button>
            </div>
            <div className="shrink-0">
              <ScoreDisplay type={m.type} status={m.status} winner={m.winner} sets={m.sets} />
            </div>
          </div>
        ))}
      </section>

      <div className="flex items-center justify-between">
        <Button onClick={() => setAddOpen(true)}>+ Agregar partido</Button>
        <Button variant="ghost" className="text-destructive" onClick={() => setDeleteEntryOpen(true)}>
          Borrar este torneo
        </Button>
      </div>

      {/* Agregar partido */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar partido</DialogTitle>
            <DialogDescription>Cargá la ronda, el rival y el resultado.</DialogDescription>
          </DialogHeader>
          {addOpen && (
            <MatchForm
              players={players}
              usedRounds={usedRounds}
              onSubmit={handleAdd}
              onPlayerCreate={createPlayer}
              onPlayerDelete={deletePlayer}
              submitLabel="Agregar"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Editar partido */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar partido</DialogTitle>
            <DialogDescription>Modificá los datos del partido.</DialogDescription>
          </DialogHeader>
          {editing && (
            <MatchForm
              players={players}
              usedRounds={usedRounds}
              initial={toInitial(editing)}
              onSubmit={handleEdit}
              onPlayerCreate={createPlayer}
              onPlayerDelete={deletePlayer}
              submitLabel="Guardar cambios"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado de partido */}
      <Dialog open={!!deletingMatch} onOpenChange={(o) => !o && setDeletingMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar partido</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button variant="destructive" onClick={confirmDeleteMatch}>
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado de participación */}
      <Dialog open={deleteEntryOpen} onOpenChange={setDeleteEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar este torneo</DialogTitle>
            <DialogDescription>
              Se quitará este torneo de tu lista junto con todos tus partidos. El torneo seguirá
              disponible en el catálogo para otros. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button variant="destructive" onClick={confirmDeleteEntry}>
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

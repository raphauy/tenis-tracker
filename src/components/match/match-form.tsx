'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Round, MatchType, MatchStatus, MatchSide } from '@prisma/client'
import type { ActionResult } from '@/lib/types'
import type { MatchPayload } from '@/lib/validations/match'
import type { SetScore } from '@/lib/tennis/set-score'
import { ROUND_ORDER } from '@/lib/tennis/derive'
import { ROUND_LABELS, MATCH_TYPE_LABELS } from '@/lib/tennis/labels'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { CatalogCombobox, type ComboOption } from '@/components/catalog/catalog-combobox'
import { ScoreInput } from '@/components/match/score-input'

export type MatchFormInitial = {
  round?: Round
  type?: MatchType
  opponentId?: string | null
  status?: MatchStatus
  sets?: SetScore[] | null
  retiredBy?: MatchSide | null
  walkoverWinner?: MatchSide | null
}

type Props = {
  players: ComboOption[]
  usedRounds: Round[]
  onSubmit: (payload: MatchPayload) => Promise<ActionResult>
  onPlayerCreate: (name: string) => Promise<ComboOption | null>
  onPlayerDelete?: (id: string) => Promise<boolean>
  initial?: MatchFormInitial
  submitLabel?: string
}

const SIDE_LABELS_WO: Record<MatchSide, string> = {
  ME: 'Gané (el rival no se presentó)',
  OPPONENT: 'Perdí (no me presenté)',
}
const SIDE_LABELS_RET: Record<MatchSide, string> = {
  ME: 'Me retiré yo',
  OPPONENT: 'Se retiró el rival',
}

export function MatchForm({
  players,
  usedRounds,
  onSubmit,
  onPlayerCreate,
  onPlayerDelete,
  initial,
  submitLabel = 'Guardar partido',
}: Props) {
  const [round, setRound] = React.useState<Round | null>(initial?.round ?? null)
  const [type, setType] = React.useState<MatchType>(initial?.type ?? MatchType.NORMAL)
  const [opponentId, setOpponentId] = React.useState<string | null>(initial?.opponentId ?? null)
  const [played, setPlayed] = React.useState<boolean>(
    initial ? initial.status === MatchStatus.PLAYED : true
  )
  const [sets, setSets] = React.useState<SetScore[]>(
    initial?.sets && initial.sets.length > 0 ? initial.sets : [{ myGames: 0, oppGames: 0 }]
  )
  const [retiredBy, setRetiredBy] = React.useState<MatchSide>(initial?.retiredBy ?? MatchSide.OPPONENT)
  const [walkoverWinner, setWalkoverWinner] = React.useState<MatchSide>(
    initial?.walkoverWinner ?? MatchSide.ME
  )
  const [saving, setSaving] = React.useState(false)

  const needsOpponent = type !== MatchType.BYE
  const showScore =
    type === MatchType.RETIRO || (type === MatchType.NORMAL && played)

  function buildPayload(): MatchPayload | null {
    if (!round) {
      toast.error('Elegí la ronda')
      return null
    }
    if (needsOpponent && !opponentId) {
      toast.error('Elegí el rival')
      return null
    }
    switch (type) {
      case MatchType.BYE:
        return { round, type: 'BYE' }
      case MatchType.WALKOVER:
        return { round, type: 'WALKOVER', opponentId: opponentId!, walkoverWinner }
      case MatchType.RETIRO:
        return { round, type: 'RETIRO', opponentId: opponentId!, retiredBy, sets }
      case MatchType.NORMAL:
        return played
          ? { round, type: 'NORMAL', opponentId: opponentId!, status: MatchStatus.PLAYED, sets }
          : { round, type: 'NORMAL', opponentId: opponentId!, status: MatchStatus.SCHEDULED }
    }
  }

  async function handleSubmit() {
    const payload = buildPayload()
    if (!payload) return
    setSaving(true)
    try {
      const res = await onSubmit(payload)
      if (!res.success) toast.error(res.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Ronda</Label>
        <Select value={round} onValueChange={(v) => setRound(v as Round)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Elegí la ronda" />
          </SelectTrigger>
          <SelectContent>
            {ROUND_ORDER.map((r) => (
              <SelectItem key={r} value={r} disabled={r !== initial?.round && usedRounds.includes(r)}>
                {ROUND_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Tipo de partido</Label>
        <Select value={type} onValueChange={(v) => setType(v as MatchType)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.values(MatchType) as MatchType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {MATCH_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsOpponent && (
        <div className="flex flex-col gap-1.5">
          <Label>Rival</Label>
          <CatalogCombobox
            options={players}
            value={opponentId}
            onChange={setOpponentId}
            onCreate={onPlayerCreate}
            onDelete={onPlayerDelete}
            placeholder="Buscar rival o crear…"
            createHint="Si el jugador no está, creálo. Los jugadores se comparten entre todos."
            createPrompt="Escribí el nombre del rival para crearlo."
          />
        </div>
      )}

      {type === MatchType.NORMAL && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="cursor-pointer"
            checked={played}
            onChange={(e) => setPlayed(e.target.checked)}
          />
          Ya se jugó (cargar marcador)
        </label>
      )}

      {type === MatchType.WALKOVER && (
        <div className="flex flex-col gap-1.5">
          <Label>Resultado del walkover</Label>
          <Select value={walkoverWinner} onValueChange={(v) => setWalkoverWinner(v as MatchSide)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.values(MatchSide) as MatchSide[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SIDE_LABELS_WO[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {type === MatchType.RETIRO && (
        <div className="flex flex-col gap-1.5">
          <Label>¿Quién se retiró?</Label>
          <Select value={retiredBy} onValueChange={(v) => setRetiredBy(v as MatchSide)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.values(MatchSide) as MatchSide[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SIDE_LABELS_RET[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showScore && (
        <div className="flex flex-col gap-1.5">
          <Label>Marcador</Label>
          <ScoreInput value={sets} onChange={setSets} />
        </div>
      )}

      <Button onClick={handleSubmit} disabled={saving} className="self-start">
        {saving ? 'Guardando…' : submitLabel}
      </Button>
    </div>
  )
}

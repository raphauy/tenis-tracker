'use client'

import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SetScore } from '@/lib/tennis/set-score'

type Props = {
  value: SetScore[]
  onChange: (sets: SetScore[]) => void
}

function num(v: string): number {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// Un set normal con tie-break termina 7-6 o 6-7. Solo entonces se carga el puntaje del tie-break.
function isTiebreakScore(myGames: number, oppGames: number): boolean {
  return (myGames === 7 && oppGames === 6) || (myGames === 6 && oppGames === 7)
}

// Editor dinámico del marcador: games por set, tie-break autodetectado (7-6) y super tie-break.
export function ScoreInput({ value, onChange }: Props) {
  function updateGames(index: number, patch: { myGames?: number; oppGames?: number }) {
    onChange(
      value.map((s, i) => {
        if (i !== index) return s
        const next: SetScore = { ...s, ...patch }
        if (next.isSuperTb) {
          // En super tie-break los games son los puntos: no hay tie-break aparte.
          delete next.tiebreak
        } else if (isTiebreakScore(next.myGames, next.oppGames)) {
          if (!next.tiebreak) next.tiebreak = { my: 0, opp: 0 }
        } else {
          delete next.tiebreak
        }
        return next
      })
    )
  }

  function updateTiebreak(index: number, patch: { my?: number; opp?: number }) {
    onChange(
      value.map((s, i) =>
        i === index ? { ...s, tiebreak: { my: 0, opp: 0, ...s.tiebreak, ...patch } } : s
      )
    )
  }

  function toggleSuperTb(index: number, on: boolean) {
    onChange(
      value.map((s, i) => {
        if (i !== index) return s
        const next: SetScore = { ...s }
        if (on) {
          next.isSuperTb = true
          delete next.tiebreak
        } else {
          delete next.isSuperTb
          if (isTiebreakScore(next.myGames, next.oppGames)) next.tiebreak = { my: 0, opp: 0 }
        }
        return next
      })
    )
  }

  function addSet() {
    // El 3er set suele ser super tie-break: viene marcado por defecto.
    const isThird = value.length === 2
    onChange([...value, { myGames: 0, oppGames: 0, ...(isThird ? { isSuperTb: true as const } : {}) }])
  }

  function removeSet(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((set, i) => {
        const showTiebreak = !set.isSuperTb && !!set.tiebreak
        return (
          <div key={i} className="rounded-lg border p-2.5">
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">Set {i + 1}</span>
              <Input
                type="number"
                min={0}
                aria-label={`Mis ${set.isSuperTb ? 'puntos' : 'games'} set ${i + 1}`}
                className="w-16"
                value={set.myGames}
                onChange={(e) => updateGames(i, { myGames: num(e.target.value) })}
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                min={0}
                aria-label={`${set.isSuperTb ? 'Puntos' : 'Games'} del rival set ${i + 1}`}
                className="w-16"
                value={set.oppGames}
                onChange={(e) => updateGames(i, { oppGames: num(e.target.value) })}
              />

              <label className="ml-3 flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={!!set.isSuperTb}
                  onChange={(e) => toggleSuperTb(i, e.target.checked)}
                />
                Super tie-break
              </label>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label={`Borrar set ${i + 1}`}
                onClick={() => removeSet(i)}
              >
                <Trash2Icon />
              </Button>
            </div>

            {showTiebreak && (
              <div className="mt-2 flex items-center gap-1.5 pl-14 text-xs">
                <span className="text-muted-foreground">Tie-break:</span>
                <Input
                  type="number"
                  min={0}
                  aria-label={`Mis puntos tie-break set ${i + 1}`}
                  className="h-7 w-14"
                  value={set.tiebreak!.my}
                  onChange={(e) => updateTiebreak(i, { my: num(e.target.value) })}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  min={0}
                  aria-label={`Puntos tie-break rival set ${i + 1}`}
                  className="h-7 w-14"
                  value={set.tiebreak!.opp}
                  onChange={(e) => updateTiebreak(i, { opp: num(e.target.value) })}
                />
              </div>
            )}

            {set.isSuperTb && (
              <p className="mt-2 pl-14 text-xs text-muted-foreground">
                Cargá los puntos del super tie-break (ej. 10-8).
              </p>
            )}
          </div>
        )
      })}

      <Button type="button" variant="outline" size="sm" className="self-start" onClick={addSet}>
        <PlusIcon /> Agregar set
      </Button>
    </div>
  )
}

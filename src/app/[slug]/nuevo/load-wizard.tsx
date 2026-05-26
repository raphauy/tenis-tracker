'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { MatchPayload } from '@/lib/validations/match'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CatalogCombobox, type ComboOption } from '@/components/catalog/catalog-combobox'
import { TournamentCombobox } from '@/components/catalog/tournament-combobox'
import { MatchForm } from '@/components/match/match-form'
import {
  createEntryWithMatchAction,
  createCategoryAction,
  createPlayerAction,
  deletePlayerAction,
} from '@/app/[slug]/actions'

type Props = {
  tournaments: ComboOption[]
  venues: ComboOption[]
  categories: ComboOption[]
  players: ComboOption[]
}

const STEPS = ['Torneo', 'Categoría', 'Partido'] as const

export function LoadWizard({ tournaments, venues, categories, players }: Props) {
  const router = useRouter()
  const { slug } = useParams<{ slug: string }>()
  const [step, setStep] = React.useState<0 | 1 | 2>(0)
  const [tournamentId, setTournamentId] = React.useState<string | null>(null)
  const [tournamentLabel, setTournamentLabel] = React.useState<string | null>(null)
  const [categoryId, setCategoryId] = React.useState<string | null>(null)
  const [categoryLabel, setCategoryLabel] = React.useState<string | null>(null)

  async function createCategory(name: string): Promise<ComboOption | null> {
    const res = await createCategoryAction(name)
    if (!res.success || !res.data) {
      toast.error(res.success ? 'No se pudo crear la categoría' : res.error)
      return null
    }
    return { id: res.data.id, label: res.data.name }
  }

  async function createPlayer(name: string): Promise<ComboOption | null> {
    const res = await createPlayerAction(name)
    if (!res.success || !res.data) {
      toast.error(res.success ? 'No se pudo crear el jugador' : res.error)
      return null
    }
    // Recién creado por mí y sin uso → borrable.
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

  async function handleSubmit(match: MatchPayload) {
    if (!tournamentId || !categoryId) {
      return { success: false as const, error: 'Faltan torneo o categoría' }
    }
    const res = await createEntryWithMatchAction({ tournamentId, categoryId, match }, slug)
    if (res.success) {
      toast.success('Torneo cargado')
      router.push(`/${slug}`)
    }
    return res
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Progreso por pasos */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                i === step && 'border-primary bg-primary text-primary-foreground',
                i < step && 'border-primary bg-primary/10 text-primary',
                i > step && 'text-muted-foreground'
              )}
            >
              {i + 1}
            </span>
            <span className={cn('text-sm', i === step ? 'font-medium' : 'text-muted-foreground')}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      {/* Resumen de lo elegido en pasos anteriores, para no perder contexto. */}
      {step > 0 && (tournamentLabel || categoryLabel) && (
        <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          {tournamentLabel && (
            <div>
              <span className="text-muted-foreground">Torneo:</span>{' '}
              <span className="font-medium">{tournamentLabel}</span>
            </div>
          )}
          {step > 1 && categoryLabel && (
            <div>
              <span className="text-muted-foreground">Categoría:</span>{' '}
              <span className="font-medium">{categoryLabel}</span>
            </div>
          )}
        </div>
      )}

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Torneo</Label>
            <TournamentCombobox
              tournamentOptions={tournaments}
              venueOptions={venues}
              value={tournamentId}
              onChange={setTournamentId}
              onSelect={(o) => setTournamentLabel(o?.label ?? null)}
            />
          </div>
          <Button className="self-end" disabled={!tournamentId} onClick={() => setStep(1)}>
            Continuar
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Categoría</Label>
            <CatalogCombobox
              options={categories}
              value={categoryId}
              onChange={setCategoryId}
              onSelect={(o) => setCategoryLabel(o?.label ?? null)}
              onCreate={createCategory}
              placeholder="Buscar categoría o crear…"
              createHint="Etiqueta del nivel (ej. 7ma, A). Si no está, creála."
              createPrompt="Escribí la categoría (ej. 7ma, A) para crearla."
            />
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Atrás
            </Button>
            <Button disabled={!categoryId} onClick={() => setStep(2)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Cargá tu primer partido. Después vas a poder agregar más desde el detalle del torneo.
          </p>
          <MatchForm
            players={players}
            usedRounds={[]}
            onSubmit={handleSubmit}
            onPlayerCreate={createPlayer}
            onPlayerDelete={deletePlayer}
            submitLabel="Guardar y finalizar"
          />
          <Button variant="ghost" className="self-start" onClick={() => setStep(1)}>
            Atrás
          </Button>
        </div>
      )}
    </div>
  )
}

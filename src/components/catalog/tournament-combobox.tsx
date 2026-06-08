'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { CatalogCombobox, type ComboOption } from '@/components/catalog/catalog-combobox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { createTournamentAction, createVenueAction } from '@/app/[slug]/actions'

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function yearRange(): number[] {
  const current = new Date().getUTCFullYear()
  const years: number[] = []
  for (let y = current + 1; y >= current - 8; y--) years.push(y)
  return years
}

type Props = {
  tournamentOptions: ComboOption[]
  venueOptions: ComboOption[]
  value: string | null
  onChange: (id: string | null) => void
  onSelect?: (option: ComboOption | null) => void
  disabled?: boolean
}

// Selector de torneo: elegir uno existente o crear uno nuevo (nombre + sede anidada + mes/año).
export function TournamentCombobox({
  tournamentOptions,
  venueOptions,
  value,
  onChange,
  onSelect,
  disabled,
}: Props) {
  const [extras, setExtras] = React.useState<ComboOption[]>([])
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [venueId, setVenueId] = React.useState<string | null>(null)
  const [month, setMonth] = React.useState<string | null>(null)
  const [year, setYear] = React.useState<string | null>(String(new Date().getUTCFullYear()))
  const [saving, setSaving] = React.useState(false)

  const allOptions = React.useMemo(
    () => [...tournamentOptions, ...extras.filter((e) => !tournamentOptions.some((o) => o.id === e.id))],
    [tournamentOptions, extras]
  )

  // onCreate del combobox: en vez de persistir con solo el nombre, abre el diálogo prellenado.
  async function openCreateDialog(typed: string): Promise<ComboOption | null> {
    setName(typed)
    setOpen(true)
    return null
  }

  async function createVenue(venueName: string): Promise<ComboOption | null> {
    const res = await createVenueAction(venueName)
    if (!res.success || !res.data) {
      toast.error(res.success ? 'No se pudo crear la sede' : res.error)
      return null
    }
    return { id: res.data.id, label: res.data.name }
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Ingresá el nombre del torneo')
    if (!venueId) return toast.error('Elegí la sede')
    if (!month) return toast.error('Elegí el mes')
    if (!year) return toast.error('Elegí el año')

    setSaving(true)
    try {
      const res = await createTournamentAction({
        name: name.trim(),
        venueId,
        month: Number(month) + 1, // index 0-11 → mes 1-12
        year: Number(year),
      })
      if (!res.success || !res.data) {
        toast.error(res.success ? 'No se pudo crear el torneo' : res.error)
        return
      }
      const option: ComboOption = {
        id: res.data.id,
        label: `${res.data.name} - ${MONTHS[Number(month)]} ${year}`,
      }
      setExtras((prev) => [...prev, option])
      onChange(option.id)
      setOpen(false)
      // Reset del borrador.
      setName('')
      setVenueId(null)
      setMonth(null)
      toast.success('Torneo creado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CatalogCombobox
        options={allOptions}
        value={value}
        onChange={onChange}
        onSelect={onSelect}
        onCreate={openCreateDialog}
        placeholder="Buscar torneo o crear…"
        createHint="Creás el torneo con su sede y fecha (mes/año)."
        allowEmptyCreate
        createLabel="Crear torneo nuevo"
        disabled={disabled}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo torneo</DialogTitle>
            <DialogDescription>Elegí la sede y la fecha. Quedará pendiente de aprobación.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tournament-name">Nombre</Label>
              <Input
                id="tournament-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="AUT Grados febrero 2026"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Sede</Label>
              <CatalogCombobox
                options={venueOptions}
                value={venueId}
                onChange={setVenueId}
                onCreate={createVenue}
                placeholder="Buscar sede o crear…"
                createHint="Si el club no está, creálo. Queda pendiente de aprobación."
                createPrompt="Escribí el club/sede para crearlo."
              />
            </div>

            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label>Mes</Label>
                <Select
                  value={month}
                  onValueChange={(v) => setMonth(v as string | null)}
                  items={Object.fromEntries(MONTHS.map((m, i) => [String(i), m]))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label>Año</Label>
                <Select
                  value={year}
                  onValueChange={(v) => setYear(v as string | null)}
                  items={Object.fromEntries(yearRange().map((y) => [String(y), String(y)]))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearRange().map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Creando…' : 'Crear torneo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

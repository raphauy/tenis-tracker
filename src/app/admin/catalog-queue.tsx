'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckIcon, PencilIcon, TrashIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogTrigger,
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
import { CatalogCombobox, type ComboOption } from '@/components/catalog/catalog-combobox'
import { MergeDialog } from './merge-dialog'
import { approveAction, deleteAction, updateNameAction, updateTournamentAction } from './actions'
import type { CatalogPending, CatalogOption } from '@/services/venue-service'
import type { TournamentPending } from '@/services/tournament-service'

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

const fmtDate = (d: Date) => new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })

type CuratedKind = 'venue' | 'category' | 'tournament'

type Props =
  | { kind: 'venue' | 'category'; items: CatalogPending[]; mergeTargets: CatalogOption[] }
  | { kind: 'tournament'; items: TournamentPending[]; mergeTargets: CatalogOption[]; venueOptions: CatalogOption[] }

const refNoun = (kind: CuratedKind, n: number) =>
  kind === 'venue' ? `${n} torneo${n === 1 ? '' : 's'}` : `${n} participación${n === 1 ? '' : 'es'}`

const toCombo = (opts: CatalogOption[]): ComboOption[] => opts.map((o) => ({ id: o.id, label: o.name }))

export function CatalogQueue(props: Props) {
  const { kind, items, mergeTargets } = props
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin entradas pendientes.</p>
  }
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{item.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {kind === 'tournament' && `${(item as TournamentPending).venueName} · `}
              {item.createdBy.name ?? item.createdBy.email ?? 'Anónimo'} · {fmtDate(item.createdAt)}
              {item.refCount > 0 && (
                <>
                  {' · '}
                  <Badge variant="outline" className="ml-1 inline-flex">
                    {refNoun(kind, item.refCount)}
                  </Badge>
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <ApproveButton kind={kind} id={item.id} />
            {kind === 'tournament' ? (
              <EditTournamentDialog item={item as TournamentPending} venueOptions={(props as Extract<Props, { kind: 'tournament' }>).venueOptions} />
            ) : (
              <EditNameDialog kind={kind} id={item.id} current={item.name} />
            )}
            <MergeDialog kind={kind} duplicate={{ id: item.id, name: item.name }} targets={toCombo(mergeTargets)} />
            <DeleteButton kind={kind} id={item.id} name={item.name} disabled={item.refCount > 0} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ApproveButton({ kind, id }: { kind: CuratedKind; id: string }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  async function approve() {
    setLoading(true)
    const res = await approveAction(kind, id)
    setLoading(false)
    if (res.success) {
      toast.success('Se aprobó')
      router.refresh()
    } else toast.error(res.error)
  }
  return (
    <Button variant="ghost" size="icon-sm" onClick={approve} disabled={loading} aria-label="Aprobar" title="Aprobar">
      {loading ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
    </Button>
  )
}

const NAME_NOUN: Record<'venue' | 'category' | 'player', string> = {
  venue: 'sede',
  category: 'categoría',
  player: 'jugador',
}

export function EditNameDialog({
  kind,
  id,
  current,
}: {
  kind: 'venue' | 'category' | 'player'
  id: string
  current: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(current)
  const [saving, setSaving] = React.useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (saving || !name.trim()) return
    setSaving(true)
    const res = await updateNameAction(kind, id, name)
    setSaving(false)
    if (res.success) {
      toast.success('Se actualizó')
      setOpen(false)
      router.refresh()
    } else toast.error(res.error)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setName(current) }}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Editar" title="Editar" />}>
        <PencilIcon />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {NAME_NOUN[kind]}</DialogTitle>
          <DialogDescription>
            {kind === 'player' ? 'Corregí el nombre (se normaliza al guardar).' : 'Corregí el nombre antes de aprobar.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="contents">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Nombre</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2Icon className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditTournamentDialog({ item, venueOptions }: { item: TournamentPending; venueOptions: CatalogOption[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(item.name)
  const [venueId, setVenueId] = React.useState<string | null>(item.venueId)
  const initialMonth = item.startDate ? String(new Date(item.startDate).getUTCMonth()) : null
  const initialYear = item.startDate ? String(new Date(item.startDate).getUTCFullYear()) : String(new Date().getUTCFullYear())
  const [month, setMonth] = React.useState<string | null>(initialMonth)
  const [year, setYear] = React.useState<string | null>(initialYear)
  const [saving, setSaving] = React.useState(false)

  function reset() {
    setName(item.name)
    setVenueId(item.venueId)
    setMonth(initialMonth)
    setYear(initialYear)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (saving || !name.trim()) return
    if (!venueId) return toast.error('Elegí la sede')
    if (!month) return toast.error('Elegí el mes')
    if (!year) return toast.error('Elegí el año')
    setSaving(true)
    const res = await updateTournamentAction(item.id, {
      name: name.trim(),
      venueId,
      month: Number(month) + 1,
      year: Number(year),
    })
    setSaving(false)
    if (res.success) {
      toast.success('Torneo actualizado')
      setOpen(false)
      router.refresh()
    } else toast.error(res.error)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset() }}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Editar" title="Editar" />}>
        <PencilIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar torneo</DialogTitle>
          <DialogDescription>Nombre, sede y fecha.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="contents">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tournament-name">Nombre</Label>
              <Input id="edit-tournament-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sede</Label>
              <CatalogCombobox options={toCombo(venueOptions)} value={venueId} onChange={setVenueId} placeholder="Buscar sede…" />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label>Mes</Label>
                <Select value={month} onValueChange={(v) => setMonth(v as string | null)} items={Object.fromEntries(MONTHS.map((m, i) => [String(i), m]))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Mes" /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (<SelectItem key={m} value={String(i)}>{m}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label>Año</Label>
                <Select value={year} onValueChange={(v) => setYear(v as string | null)} items={Object.fromEntries(yearRange().map((y) => [String(y), String(y)]))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Año" /></SelectTrigger>
                  <SelectContent>
                    {yearRange().map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2Icon className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteButton({
  kind,
  id,
  name,
  disabled,
}: {
  kind: CatalogKindForDelete
  id: string
  name: string
  disabled: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  async function confirm() {
    setDeleting(true)
    const res = await deleteAction(kind, id)
    setDeleting(false)
    if (res.success) {
      toast.success('Se eliminó')
      setOpen(false)
      router.refresh()
    } else toast.error(res.error)
  }

  if (disabled) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        disabled
        aria-label="Eliminar"
        title="En uso: fusionala en su lugar"
        className="text-muted-foreground"
      >
        <TrashIcon />
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Eliminar" title="Eliminar" className="text-destructive hover:text-destructive" />}>
        <TrashIcon />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar «{name}»</DialogTitle>
          <DialogDescription>Esta acción no se puede deshacer. La entrada no tiene referencias.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting && <Loader2Icon className="animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type CatalogKindForDelete = 'venue' | 'category' | 'tournament' | 'player'

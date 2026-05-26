'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { GitMergeIcon, Loader2Icon } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { CatalogCombobox, type ComboOption } from '@/components/catalog/catalog-combobox'
import { mergeAction, mergeImpactAction } from './actions'
import type { CatalogKind } from '@/lib/validations/admin'

type Impact = { entryCount?: number; matchCount?: number; tournamentCount?: number }

const KIND_LABEL: Record<CatalogKind, string> = {
  venue: 'sede',
  category: 'categoría',
  tournament: 'torneo',
  player: 'jugador',
}

function impactText(kind: CatalogKind, impact: Impact): string {
  if (kind === 'venue') return `${impact.tournamentCount ?? 0} torneo(s)`
  if (kind === 'player') return `${impact.matchCount ?? 0} partido(s)`
  return `${impact.entryCount ?? 0} participación(es) y ${impact.matchCount ?? 0} partido(s)`
}

type Props = {
  kind: CatalogKind
  duplicate: { id: string; name: string }
  // Destinos canónicos posibles (ya excluyen al duplicado).
  targets: ComboOption[]
}

export function MergeDialog({ kind, duplicate, targets }: Props) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [canonicalId, setCanonicalId] = React.useState<string | null>(null)
  const [impact, setImpact] = React.useState<Impact | null>(null)
  const [loadingImpact, setLoadingImpact] = React.useState(false)
  const [merging, setMerging] = React.useState(false)

  // Carga el impacto (depende solo del duplicado) al abrir.
  React.useEffect(() => {
    if (!open) return
    setImpact(null)
    setCanonicalId(null)
    setLoadingImpact(true)
    mergeImpactAction(kind, duplicate.id)
      .then((res) => {
        if (res.success) setImpact(res.data ?? {})
        else toast.error(res.error)
      })
      .finally(() => setLoadingImpact(false))
  }, [open, kind, duplicate.id])

  async function handleMerge() {
    if (!canonicalId || merging) return
    setMerging(true)
    const res = await mergeAction(kind, { duplicateId: duplicate.id, canonicalId })
    setMerging(false)
    if (res.success) {
      toast.success('Fusión realizada')
      setOpen(false)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Fusionar ${duplicate.name}`} title="Fusionar en otra entrada" />
        }
      >
        <GitMergeIcon />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fusionar {KIND_LABEL[kind]}</DialogTitle>
          <DialogDescription>
            Elegí la entrada canónica. <span className="font-medium text-foreground">«{duplicate.name}»</span> se
            archivará y sus referencias pasarán a la elegida.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <CatalogCombobox
            options={targets}
            value={canonicalId}
            onChange={setCanonicalId}
            placeholder={`Buscar ${KIND_LABEL[kind]} canónico…`}
            emptyText="Sin candidatos"
          />

          <p className="text-sm text-muted-foreground">
            {loadingImpact ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2Icon className="size-3.5 animate-spin" /> Calculando impacto…
              </span>
            ) : impact ? (
              <>
                Reapunta <span className="font-medium text-foreground">{impactText(kind, impact)}</span> y archiva la
                entrada duplicada.
              </>
            ) : null}
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button onClick={handleMerge} disabled={!canonicalId || merging}>
            {merging && <Loader2Icon className="animate-spin" />}
            Fusionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { AlertTriangleIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react'
import { useMounted } from '@/hooks/use-mounted'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { syncNowAction } from './actions'

export type AdminBracket = {
  id: string
  categoryName: string
  slug: string
  lastSyncedAt: Date
  lastSyncError: string | null
}

export type AdminTournament = {
  id: string
  name: string
  slug: string
  status: 'LIVE' | 'ARCHIVED'
  sourceType: string
  lastSyncedAt: Date | null
  lastSyncError: string | null
  brackets: AdminBracket[]
}

// Fecha/hora en la timezone del navegador; vacío hasta montar (evita hydration mismatch
// porque el server corre en UTC). Mismo patrón que el panel de WhatsApp.
function Time({ date }: { date: Date | null }) {
  const mounted = useMounted()
  if (!date) return <>—</>
  return <>{mounted ? format(date, 'd/M/yyyy HH:mm', { locale: es }) : ''}</>
}

export function CuadrosPanel({
  sources,
  tournaments,
}: {
  sources: string[]
  tournaments: AdminTournament[]
}) {
  const router = useRouter()
  const [syncing, setSyncing] = React.useState(false)

  async function sync() {
    setSyncing(true)
    const res = await syncNowAction()
    setSyncing(false)
    if (res.success) {
      const r = res.data
      const errors = r?.errors.length ?? 0
      const removed = r?.removedBrackets ?? 0
      toast.success(
        `Sync OK: ${r?.brackets ?? 0} cuadros, ${r?.skipped ?? 0} omitidos` +
          (removed ? `, ${removed} eliminados` : '') +
          (errors ? `, ${errors} con error` : '')
      )
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {sources.length} fuente{sources.length === 1 ? '' : 's'} configurada
          {sources.length === 1 ? '' : 's'}.
        </p>
        <Button onClick={sync} disabled={syncing} size="sm">
          {syncing ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Sincronizar ahora
        </Button>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          Todavía no se sincronizó ningún torneo. Tocá “Sincronizar ahora”.
        </div>
      ) : (
        tournaments.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <Badge variant={t.status === 'LIVE' ? 'default' : 'secondary'}>
                  {t.status === 'LIVE' ? 'En vivo' : 'Finalizado'}
                </Badge>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                Sync: <Time date={t.lastSyncedAt} />
              </span>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">{t.sourceType}</p>

              {t.lastSyncError && (
                <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                  <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" /> {t.lastSyncError}
                </p>
              )}

              <ul className="divide-y">
                {t.brackets.length === 0 ? (
                  <li className="py-1.5 text-xs text-muted-foreground">Sin categorías con cuadro.</li>
                ) : (
                  t.brackets.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0 truncate">{b.categoryName}</span>
                      {b.lastSyncError ? (
                        <Badge variant="destructive" className="shrink-0">
                          error
                        </Badge>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          <Time date={b.lastSyncedAt} />
                        </span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

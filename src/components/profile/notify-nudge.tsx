'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BellIcon, XIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { dismissNotifyNudgeAction } from '@/components/profile/notify-nudge-actions'
import type { NudgeReason } from '@/services/notification-service'

// Cartel descartable (con X, persistente) que invita a activar un canal de notificaciones.
// Aparece sólo al dueño con favoritos y sin avisos efectivos. Distinto del banner de email
// (ese es sticky/sin X, sobre auth). Decisión grill-me.
const COPY: Record<NudgeReason, string> = {
  'no-channel':
    'Seguís a jugadores pero tenés los avisos apagados: no te vamos a avisar de sus resultados.',
  'no-email': 'Agregá tu email para recibir también por ahí los resultados de tus favoritos.',
}

export function NotifyNudge({ slug, reason }: { slug: string; reason: NudgeReason }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function dismiss() {
    setDismissed(true) // optimista; se persiste server-side
    const res = await dismissNotifyNudgeAction()
    if (!res.success) setDismissed(false)
  }

  return (
    <div className="border-b border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-sm">
        <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200">
          <BellIcon className="size-4 shrink-0" />
          <span>{COPY[reason]}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/${slug}/notificaciones`}
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'border-sky-300 dark:border-sky-800')}
          >
            Configurar
          </Link>
          <Button variant="ghost" size="icon" className="size-8" onClick={dismiss} aria-label="Descartar">
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRightIcon, MailIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { WhatsAppIcon } from '@/components/whatsapp-icon'
import { openEmailBannerDialog } from '@/components/profile/email-banner'
import type { NotificationSettings } from '@/services/notification-service'
import { setFavoriteChannelAction, setNotifyModeAction } from './actions'

type EmailMode = NotificationSettings['emailMode']
type WhatsappMode = NotificationSettings['whatsappMode']
type FavChannel = 'notifyEmail' | 'notifyWhatsapp'

// Pocas opciones → segmented control (todas a la vista), no Select.
const EMAIL_MODE_OPTIONS: { value: EmailMode; label: string }[] = [
  { value: 'OFF', label: 'No recibir' },
  { value: 'IMMEDIATE', label: 'Cada resultado' },
  { value: 'DIGEST', label: 'Resumen diario' },
]
const WHATSAPP_MODE_OPTIONS: { value: WhatsappMode; label: string }[] = [
  { value: 'OFF', label: 'No recibir' },
  { value: 'IMMEDIATE', label: 'Cada resultado' },
]

// La descripción explica el modo ELEGIDO (qué va a pasar), no el canal en abstracto.
const EMAIL_MODE_DESCRIPTIONS: Record<EmailMode, string> = {
  OFF: 'No te mandamos ningún email.',
  IMMEDIATE: 'Te llega un email apenas un favorito tuyo registra un resultado.',
  DIGEST: 'Un solo email a la mañana, con todos los resultados del día anterior.',
}
const WHATSAPP_MODE_DESCRIPTIONS: Record<WhatsappMode, string> = {
  OFF: 'No te mandamos mensajes de WhatsApp.',
  IMMEDIATE: 'Te llega un WhatsApp apenas un favorito tuyo registra un resultado.',
}

// Grilla compartida por el header y las filas de favoritos, para que las columnas alineen.
const FAV_GRID = 'grid grid-cols-[minmax(0,1fr)_3.5rem_4.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_6rem]'

export function NotificationsForm({
  slug,
  settings,
}: {
  slug: string
  settings: NotificationSettings
}) {
  const router = useRouter()
  const [emailMode, setEmailMode] = React.useState<EmailMode>(settings.emailMode)
  const [whatsappMode, setWhatsappMode] = React.useState<WhatsappMode>(settings.whatsappMode)
  const [favorites, setFavorites] = React.useState(settings.favorites)

  // Canal globalmente apagado → su columna de favoritos no tiene efecto: se muestra
  // atenuada y deshabilitada (la causa está visible justo arriba, en el modo del canal).
  const emailColumnOff = emailMode === 'OFF' || !settings.emailVerified
  const whatsappColumnOff = whatsappMode === 'OFF'

  async function changeEmailMode(next: EmailMode) {
    const prev = emailMode
    setEmailMode(next)
    const res = await setNotifyModeAction({ slug, emailMode: next })
    if (!res.success) {
      setEmailMode(prev)
      toast.error(res.error)
      return
    }
    router.refresh()
  }

  async function changeWhatsappMode(next: WhatsappMode) {
    const prev = whatsappMode
    setWhatsappMode(next)
    const res = await setNotifyModeAction({ slug, whatsappMode: next })
    if (!res.success) {
      setWhatsappMode(prev)
      toast.error(res.error)
      return
    }
    router.refresh()
  }

  async function toggleFavorite(nameKey: string, channel: FavChannel, value: boolean) {
    const prev = favorites
    setFavorites((favs) =>
      favs.map((f) => (f.nameKey === nameKey ? { ...f, [channel]: value } : f))
    )
    const patch = channel === 'notifyEmail' ? { notifyEmail: value } : { notifyWhatsapp: value }
    const res = await setFavoriteChannelAction({ slug, nameKey, ...patch })
    if (!res.success) {
      setFavorites(prev)
      toast.error(res.error)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Modos globales por canal */}
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <MailIcon
              aria-hidden
              className={cn('size-4 shrink-0', emailColumnOff ? 'text-muted-foreground/60' : 'text-primary')}
            />
            <Label>Email</Label>
          </div>
          <SegmentedControl
            aria-label="Avisos por email"
            value={emailMode}
            onValueChange={changeEmailMode}
            options={EMAIL_MODE_OPTIONS}
            disabled={!settings.emailVerified}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {settings.emailVerified ? (
              EMAIL_MODE_DESCRIPTIONS[emailMode]
            ) : (
              <>
                Verificá tu email para activar este canal.{' '}
                <button
                  type="button"
                  className="text-primary cursor-pointer underline-offset-4 hover:underline"
                  onClick={openEmailBannerDialog}
                >
                  Verificar email
                </button>
              </>
            )}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <WhatsAppIcon
              className={cn('size-4 shrink-0', whatsappColumnOff ? 'text-muted-foreground/60' : 'text-primary')}
            />
            <Label>WhatsApp</Label>
          </div>
          <SegmentedControl
            aria-label="Avisos por WhatsApp"
            value={whatsappMode}
            onValueChange={changeWhatsappMode}
            options={WHATSAPP_MODE_OPTIONS}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {WHATSAPP_MODE_DESCRIPTIONS[whatsappMode]}
          </p>
        </div>
      </div>

      {/* Favoritos: toggles por canal */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          Tus favoritos
          {favorites.length > 0 && (
            <span className="font-normal text-muted-foreground"> · {favorites.length}</span>
          )}
        </h3>
        <p className="text-sm text-muted-foreground">
          Silenciá un favorito por canal sin dejar de seguirlo (sigue resaltado en Cuadros).
        </p>
        {favorites.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Todavía no seguís a nadie. Marcá favoritos con la estrella en{' '}
            <Link href="/cuadros" className="text-foreground underline">
              Cuadros
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border">
              <div className={cn(FAV_GRID, 'border-b bg-muted/40 px-3 py-2')}>
                <span className="text-xs font-medium text-muted-foreground">Jugador</span>
                <span
                  className={cn(
                    'flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground',
                    emailColumnOff && 'opacity-40'
                  )}
                >
                  <MailIcon aria-hidden className="size-3.5" />
                  <span className="sr-only sm:not-sr-only">Email</span>
                </span>
                <span
                  className={cn(
                    'flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground',
                    whatsappColumnOff && 'opacity-40'
                  )}
                >
                  <WhatsAppIcon className="size-3.5" />
                  <span className="sr-only sm:not-sr-only">WhatsApp</span>
                </span>
              </div>
              <ul className="flex flex-col divide-y">
                {favorites.map((f) => (
                  <li key={f.nameKey} className={cn(FAV_GRID, 'px-3 py-2.5')}>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{f.name}</span>
                      {f.orphaned && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TriangleAlertIcon className="size-3 shrink-0" />
                          Ya no aparece en los cuadros
                        </span>
                      )}
                    </span>
                    <span className={cn('flex justify-center', emailColumnOff && 'opacity-40')}>
                      <Switch
                        aria-label={`Avisos por email de ${f.name}`}
                        checked={f.notifyEmail}
                        disabled={emailColumnOff}
                        onCheckedChange={(v) => toggleFavorite(f.nameKey, 'notifyEmail', v)}
                      />
                    </span>
                    <span className={cn('flex justify-center', whatsappColumnOff && 'opacity-40')}>
                      <Switch
                        aria-label={`Avisos por WhatsApp de ${f.name}`}
                        checked={f.notifyWhatsapp}
                        disabled={whatsappColumnOff}
                        onCheckedChange={(v) => toggleFavorite(f.nameKey, 'notifyWhatsapp', v)}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {(emailColumnOff || whatsappColumnOff) && (
              <p className="text-xs text-muted-foreground">
                Las columnas atenuadas corresponden a canales en «No recibir»: activá el canal
                arriba para afinar por favorito.
              </p>
            )}
            <Link
              href="/cuadros"
              className="mt-1 inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
            >
              Marcá más favoritos en Cuadros
              <ArrowRightIcon aria-hidden className="size-3.5" />
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

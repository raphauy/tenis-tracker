'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { useMounted } from '@/hooks/use-mounted'
import {
  CheckIcon,
  XIcon,
  Loader2Icon,
  RefreshCwIcon,
  ExternalLinkIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { sendTextAction } from './actions'
import type {
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppNumberStatus,
} from '@/services/whatsapp-service'

type Props = {
  status: WhatsAppNumberStatus
  conversations: WhatsAppConversation[]
  selectedId: string | null
  thread: WhatsAppMessage[]
}

// Fecha/hora en la timezone del navegador (date-fns usa la local por defecto).
// Renderiza vacío hasta montar: en SSR el server corre en UTC y diferiría del
// cliente local → hydration mismatch. useMounted evita ese desajuste.
function Time({ date }: { date: Date | null }) {
  const mounted = useMounted()
  if (!date) return null
  return <>{mounted ? format(date, "d/M/yyyy HH:mm", { locale: es }) : ''}</>
}

export function WhatsAppPanel({ status, conversations, selectedId, thread }: Props) {
  const router = useRouter()
  const selected = conversations.find((c) => c.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <StatusCard status={status} onRefresh={() => router.refresh()} />

      <div className="grid gap-4 sm:grid-cols-[18rem_1fr]">
        <ConversationList conversations={conversations} selectedId={selectedId} />
        <ThreadView conversation={selected} thread={thread} />
      </div>
    </div>
  )
}

function StatusCard({
  status,
  onRefresh,
}: {
  status: WhatsAppNumberStatus
  onRefresh: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">
            {status.displayName ?? 'Número de WhatsApp'}
          </CardTitle>
          <Badge variant={status.health === 'healthy' ? 'default' : 'destructive'}>
            {status.health === 'healthy' ? 'Saludable' : 'Con problemas'}
          </Badge>
          {status.kind && <Badge variant="outline">{status.kind}</Badge>}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCwIcon /> Actualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
          <dt>Número</dt>
          <dd className="text-foreground">{status.displayPhoneNumber ?? '—'}</dd>
          <dt>Calidad</dt>
          <dd className="text-foreground">{status.qualityRating ?? '—'}</dd>
          <dt>Estado WABA</dt>
          <dd className="text-foreground">{status.wabaReviewStatus ?? '—'}</dd>
          <dt>Método de pago (Meta)</dt>
          <dd className="text-foreground">
            {status.paymentMethodOk === null ? '—' : status.paymentMethodOk ? 'OK' : 'Con problema'}
          </dd>
        </dl>

        <ul className="space-y-1">
          {status.checks.map((check) => (
            <li key={check.name} className="flex items-start gap-2">
              {check.passed ? (
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              ) : (
                <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <span>
                <span className="text-foreground">{check.name}</span>
                {check.error && (
                  <span className="text-muted-foreground"> — {check.error}</span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={status.billingUrl} target="_blank" rel="noopener noreferrer" />}
        >
          Ver balance y costos en Kapso <ExternalLinkIcon />
        </Button>
      </CardContent>
    </Card>
  )
}

function ConversationList({
  conversations,
  selectedId,
}: {
  conversations: WhatsAppConversation[]
  selectedId: string | null
}) {
  if (conversations.length === 0) {
    return (
      <Card className="sm:max-h-[28rem]">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Todavía no hay conversaciones. Escribile al número del proyecto desde tu teléfono para
          abrir la primera.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-0 sm:max-h-[28rem] sm:overflow-y-auto">
      <ul className="divide-y">
        {conversations.map((c) => {
          const active = c.id === selectedId
          return (
            <li key={c.id}>
              <Link
                href={`/admin/whatsapp?c=${c.id}`}
                className={cn(
                  'block px-4 py-3 transition-colors hover:bg-muted/50',
                  active && 'bg-muted'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {c.contactName ?? c.phone ?? 'Sin nombre'}
                  </span>
                  <Badge variant={c.windowOpen ? 'secondary' : 'outline'} className="shrink-0">
                    {c.windowOpen ? 'Abierta' : 'Cerrada'}
                  </Badge>
                </div>
                {c.lastMessageText && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">{c.lastMessageText}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  <Time date={c.lastMessageAt} />
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function ThreadView({
  conversation,
  thread,
}: {
  conversation: WhatsAppConversation | null
  thread: WhatsAppMessage[]
}) {
  if (!conversation) {
    return (
      <Card className="flex items-center justify-center">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Elegí una conversación para ver el hilo.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">
          {conversation.contactName ?? conversation.phone}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-2 sm:max-h-[18rem] sm:overflow-y-auto">
          {thread.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin mensajes en esta conversación.</p>
          )}
          {thread.map((m) => (
            <div
              key={m.id}
              className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                m.direction === 'outbound'
                  ? 'self-end bg-primary text-primary-foreground'
                  : 'self-start bg-muted'
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p
                className={cn(
                  'mt-1 text-xs',
                  m.direction === 'outbound'
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground'
                )}
              >
                <Time date={m.timestamp} />
              </p>
            </div>
          ))}
        </div>

        <ReplyForm to={conversation.phone} windowOpen={conversation.windowOpen} />
      </CardContent>
    </Card>
  )
}

function ReplyForm({ to, windowOpen }: { to: string; windowOpen: boolean }) {
  const router = useRouter()
  const [body, setBody] = React.useState('')
  const [sending, setSending] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    // El teléfono de Kapso viene sin '+'; lo normalizamos a E.164 para la action.
    const phone = to.startsWith('+') ? to : `+${to}`
    setSending(true)
    const res = await sendTextAction({ to: phone, body: text })
    setSending(false)
    if (res.success) {
      setBody('')
      toast.success('Mensaje enviado')
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  if (!windowOpen) {
    return (
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        La ventana de 24 h está cerrada. Solo se puede responder texto libre si el contacto escribió
        en las últimas 24 h.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          // Enter envía; cualquier Enter con modificador (Ctrl/Shift/Cmd/Alt) inserta salto.
          if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
            e.preventDefault()
            e.currentTarget.form?.requestSubmit()
          }
        }}
        placeholder="Escribí una respuesta…"
        rows={2}
        disabled={sending}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={sending || body.trim().length === 0}>
          {sending && <Loader2Icon className="animate-spin" />} Enviar
        </Button>
      </div>
    </form>
  )
}

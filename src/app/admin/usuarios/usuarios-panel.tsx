'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  SearchIcon,
  MailPlusIcon,
  SendIcon,
  TrashIcon,
  Loader2Icon,
  CheckIcon,
  XIcon,
  ExternalLinkIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { GeneratedAvatar } from '@/components/generated-avatar'
import { RoleBadge } from '@/components/role-badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from '@/components/ui/card'
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import type { UserAdmin } from '@/services/user-service'
import type { InvitationAdmin } from '@/services/invitation-service'
import { cancelInvitationAction, inviteUserAction, resendInvitationAction } from './actions'

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })

// ---------- Invitaciones ----------

type InvitationStatus = 'aceptada' | 'pendiente' | 'expirada'

function invitationStatus(inv: InvitationAdmin): InvitationStatus {
  if (inv.acceptedAt) return 'aceptada'
  if (new Date(inv.expiresAt) < new Date()) return 'expirada'
  return 'pendiente'
}

function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  if (status === 'aceptada') return <Badge variant="secondary">Aceptada</Badge>
  if (status === 'expirada') return <Badge variant="destructive">Expirada</Badge>
  return <Badge variant="outline">Pendiente</Badge>
}

function InviteDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [sending, setSending] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (sending || !name.trim() || !email.trim()) return
    setSending(true)
    const res = await inviteUserAction({ name: name.trim(), email: email.trim() })
    setSending(false)
    if (res.success) {
      toast.success('Invitación enviada')
      setOpen(false)
      router.refresh()
    } else toast.error(res.error)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setName('')
          setEmail('')
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <MailPlusIcon />
        Invitar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar a un potencial usuario</DialogTitle>
          <DialogDescription>
            Le llega un email con un link para crear su cuenta (el registro es por WhatsApp).
            La invitación expira en 7 días.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="contents">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-name">Nombre</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la persona"
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@email.com"
                maxLength={120}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={sending || !name.trim() || !email.trim()}>
              {sending && <Loader2Icon className="animate-spin" />}
              Enviar invitación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResendButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  async function resend() {
    setLoading(true)
    const res = await resendInvitationAction(id)
    setLoading(false)
    if (res.success) {
      toast.success('Invitación reenviada')
      router.refresh()
    } else toast.error(res.error)
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={resend}
            disabled={loading}
            aria-label="Reenviar"
          />
        }
      >
        {loading ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
      </TooltipTrigger>
      <TooltipContent>Reenviar (rota el link y extiende la expiración)</TooltipContent>
    </Tooltip>
  )
}

function CancelInvitationButton({ id, email }: { id: string; email: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  async function confirm() {
    setDeleting(true)
    const res = await cancelInvitationAction(id)
    setDeleting(false)
    if (res.success) {
      toast.success('Invitación eliminada')
      setOpen(false)
      router.refresh()
    } else toast.error(res.error)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Eliminar"
                  className="text-destructive hover:text-destructive"
                />
              }
            />
          }
        >
          <TrashIcon />
        </TooltipTrigger>
        <TooltipContent>Eliminar</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar invitación</DialogTitle>
          <DialogDescription>
            El link enviado a {email} deja de funcionar. Podés volver a invitar después.
          </DialogDescription>
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

function InvitationsCard({ invitations }: { invitations: InvitationAdmin[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitaciones</CardTitle>
        <CardDescription>
          Invitá por email a potenciales usuarios y mirá quién aceptó.
        </CardDescription>
        <CardAction>
          <InviteDialog />
        </CardAction>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin invitaciones todavía.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {invitations.map((inv) => {
              const status = invitationStatus(inv)
              return (
                <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate">
                      <span className="truncate font-medium">{inv.name}</span>
                      <InvitationStatusBadge status={status} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inv.email} · enviada {fmtDate(inv.lastSentAt)}
                      {status === 'pendiente' && <> · expira {fmtDate(inv.expiresAt)}</>}
                      {status === 'aceptada' && inv.acceptedAt && (
                        <>
                          {' · aceptada '}
                          {fmtDate(inv.acceptedAt)}
                          {inv.acceptedUser?.slug && (
                            <>
                              {' → '}
                              <Link
                                href={`/${inv.acceptedUser.slug}`}
                                className="underline underline-offset-2 hover:text-foreground"
                              >
                                /{inv.acceptedUser.slug}
                              </Link>
                            </>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  {status !== 'aceptada' && (
                    <TooltipProvider>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <ResendButton id={inv.id} />
                        <CancelInvitationButton id={inv.id} email={inv.email} />
                      </div>
                    </TooltipProvider>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Usuarios ----------

type EstadoFilter = 'todos' | 'activos' | 'inactivos'

const EMAIL_MODE_LABEL: Record<UserAdmin['notifyEmailMode'], string> = {
  OFF: 'Apagado',
  IMMEDIATE: 'Cada resultado',
  DIGEST: 'Resumen diario',
}

const WA_MODE_LABEL: Record<UserAdmin['notifyWhatsappMode'], string> = {
  OFF: 'Apagado',
  IMMEDIATE: 'Cada resultado',
}

function Verified({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
      <CheckIcon className="size-3.5" /> verificado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <XIcon className="size-3.5" /> sin verificar
    </span>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words">{children}</dd>
    </div>
  )
}

function UserDetailDialog({ user, onClose }: { user: UserAdmin; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              {user.image && <AvatarImage src={user.image} alt={user.name ?? ''} />}
              <AvatarFallback className="bg-muted p-0">
                <GeneratedAvatar seed={user.id} title={user.name ?? 'Avatar'} />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <span className="truncate">{user.name ?? 'Sin nombre'}</span>
                <RoleBadge role={user.role} />
              </DialogTitle>
              <DialogDescription>
                Registrado el {fmtDate(user.createdAt)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <dl className="flex flex-col divide-y">
          <DetailRow label="Perfil">
            {user.slug ? (
              <Link
                href={`/${user.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                /{user.slug}
                <ExternalLinkIcon className="size-3.5" />
              </Link>
            ) : (
              <span className="text-muted-foreground">sin onboarding</span>
            )}
          </DetailRow>
          <DetailRow label="Estado">
            {user.isActive ? 'Activo' : <span className="text-destructive">Inactivo</span>}
          </DetailRow>
          <DetailRow label="Teléfono">
            <span className="flex flex-col items-end">
              {user.phone}
              <Verified ok={user.phoneVerifiedAt !== null} />
            </span>
          </DetailRow>
          <DetailRow label="Email">
            {user.email ? (
              <span className="flex flex-col items-end">
                {user.email}
                <Verified ok={user.emailVerifiedAt !== null} />
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailRow>
          <DetailRow label="Visibilidad">
            {user.visibility === 'PUBLIC' ? 'Público' : 'Privado'}
          </DetailRow>
          <DetailRow label="Notif. por email">{EMAIL_MODE_LABEL[user.notifyEmailMode]}</DetailRow>
          <DetailRow label="Notif. por WhatsApp">
            {WA_MODE_LABEL[user.notifyWhatsappMode]}
          </DetailRow>
          <DetailRow label="Participaciones">{user.entryCount}</DetailRow>
          <DetailRow label="Favoritos">{user.favoriteCount}</DetailRow>
        </dl>
      </DialogContent>
    </Dialog>
  )
}

function UsersCard({ users }: { users: UserAdmin[] }) {
  const [query, setQuery] = React.useState('')
  const [estado, setEstado] = React.useState<EstadoFilter>('todos')
  const [selected, setSelected] = React.useState<UserAdmin | null>(null)

  const lower = query.trim().toLowerCase()
  const filtered = React.useMemo(
    () =>
      users.filter((u) => {
        if (estado === 'activos' && !u.isActive) return false
        if (estado === 'inactivos' && u.isActive) return false
        if (!lower) return true
        return [u.name, u.slug, u.email, u.phone].some((f) =>
          f?.toLowerCase().includes(lower)
        )
      }),
    [users, lower, estado]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Registrados <span className="font-normal text-muted-foreground">({users.length})</span>
        </CardTitle>
        <CardDescription>Tocá un usuario para ver sus datos.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, link, email o teléfono…"
              className="pl-8"
            />
          </div>
          <SegmentedControl
            value={estado}
            onValueChange={setEstado}
            aria-label="Filtrar por estado"
            className="sm:w-64"
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'activos', label: 'Activos' },
              { value: 'inactivos', label: 'Inactivos' },
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin usuarios.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {filtered.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => setSelected(user)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                    !user.isActive && 'opacity-60'
                  )}
                >
                  <Avatar>
                    {user.image && <AvatarImage src={user.image} alt={user.name ?? ''} />}
                    <AvatarFallback className="bg-muted p-0">
                      <GeneratedAvatar seed={user.id} title={user.name ?? 'Avatar'} />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="truncate font-medium">{user.name ?? 'Sin nombre'}</span>
                      <RoleBadge role={user.role} />
                      {!user.isActive && <Badge variant="destructive">Inactivo</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.slug ? `/${user.slug}` : 'sin onboarding'} · {user.phone}
                      {user.email && ` · ${user.email}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtDate(user.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {selected && <UserDetailDialog user={selected} onClose={() => setSelected(null)} />}
    </Card>
  )
}

export function UsuariosPanel({
  users,
  invitations,
}: {
  users: UserAdmin[]
  invitations: InvitationAdmin[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <InvitationsCard invitations={invitations} />
      <UsersCard users={users} />
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangleIcon, MailCheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import {
  requestEmailVerifyAction,
  verifyEmailAction,
} from '@/components/profile/email-banner-actions'

// Banner persistente del Email backup (Fase 2 whatsapp-kapso). Aparece en toda vista del
// dueño hasta que `User.emailVerifiedAt != null`. No tiene X — la única salida es agregar
// y verificar el email. Ver docs/context.md § "Banner de email" y ADR 0002.
//
// El componente se monta SIEMPRE (no condicional): `show` controla el banner visible. Así el
// dialog de éxito post-verificación sobrevive al re-render que oculta el banner al verificar.

export type EmailBannerState = 'no-email' | 'pending-verify'

type DialogStep = 'add-email' | 'enter-otp'

export function EmailBanner({
  show,
  state,
  email,
  slug,
}: {
  show: boolean
  state: EmailBannerState
  email?: string | null
  slug?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [step, setStep] = useState<DialogStep>('add-email')
  const [emailInput, setEmailInput] = useState(email ?? '')
  const [pendingEmail, setPendingEmail] = useState(email ?? '')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  async function openDialog() {
    // Refresca el estado interno por si cambió en el server mientras tanto.
    setEmailInput(email ?? '')
    setPendingEmail(email ?? '')
    setOtp('')
    setOpen(true)

    if (state === 'pending-verify' && email) {
      // Estado 'pending-verify' = User ya tiene email pero no está verificado. El
      // OTP previo (si lo hubo) puede no existir o estar vencido. Auto-disparamos
      // un OTP nuevo al abrir y mostramos enter-otp; si falla, caemos a add-email
      // para que el usuario pueda reintentar o cambiar el email.
      setStep('enter-otp')
      setLoading(true)
      const res = await requestEmailVerifyAction(email)
      setLoading(false)
      if (!res.success) {
        toast.error(res.error)
        setStep('add-email')
        return
      }
      if (!res.data) {
        toast.error('No pudimos enviar el código.')
        setStep('add-email')
        return
      }
      setPendingEmail(res.data.email)
      toast.success(`Código enviado a ${res.data.email}`)
    } else {
      setStep('add-email')
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await requestEmailVerifyAction(emailInput)
    setLoading(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    if (!res.data) {
      toast.error('No pudimos enviar el código.')
      return
    }
    setPendingEmail(res.data.email)
    setStep('enter-otp')
    toast.success(`Código enviado a ${res.data.email}`)
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6) return
    setLoading(true)
    const res = await verifyEmailAction({ email: pendingEmail, otp })
    setLoading(false)
    if (!res.success) {
      toast.error(res.error)
      setOtp('')
      return
    }
    toast.success('Email verificado.')
    setOpen(false)
    setSuccessOpen(true) // avisa que ya puede recibir por email (no cambia preferencias)
  }

  const bannerCopy =
    state === 'no-email'
      ? 'Agregá un email como respaldo si no podés usar WhatsApp.'
      : 'Verificá tu email para activar el respaldo de tu cuenta.'

  const buttonLabel = state === 'no-email' ? 'Agregar' : 'Verificar'

  return (
    <>
      {show && (
        <div className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 border-b">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-sm">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <AlertTriangleIcon className="size-4 shrink-0" />
              <span>{bannerCopy}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 dark:border-amber-800"
              onClick={openDialog}
            >
              {buttonLabel}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {step === 'add-email' ? 'Agregar email' : 'Verificar email'}
            </DialogTitle>
            <DialogDescription>
              {step === 'add-email'
                ? 'Te mandamos un código de 6 dígitos para confirmar que es tuyo.'
                : `Ingresá el código que enviamos a ${pendingEmail}.`}
            </DialogDescription>
          </DialogHeader>

          {step === 'add-email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-banner-input">Email</Label>
                <Input
                  id="email-banner-input"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  disabled={loading}
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !emailInput}>
                {loading ? 'Enviando…' : 'Enviar código'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label className="block text-center">Código</Label>
                <InputOTP
                  containerClassName="justify-center"
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={loading}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? 'Verificando…' : 'Verificar'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('add-email')
                  setOtp('')
                }}
                disabled={loading}
              >
                Usar otro email
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Éxito post-verificación: avisa que ya puede recibir por email. NO cambia preferencias. */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailCheckIcon className="size-5 text-emerald-600" />
              ¡Email verificado!
            </DialogTitle>
            <DialogDescription>
              Ya podés recibir los resultados de tus favoritos por email, con un resumen diario.
              Activá el canal y elegí cómo querés que te avisemos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Ahora no</DialogClose>
            {slug ? (
              <DialogClose
                render={<Link href={`/${slug}/notificaciones`} className={buttonVariants()} />}
              >
                Configurar notificaciones
              </DialogClose>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

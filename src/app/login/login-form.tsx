'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { afterLoginAction, requestOtpAction, requestWaLoginAction } from './actions'
import type { WaAuthStatus } from '@/app/api/auth/wa/status/route'

// Estados del form:
//   - 'idle'         → botón WA + link a email backup
//   - 'wa-waiting'   → tras click WA, polling al endpoint hasta consumed/rejected/timeout
//   - 'email-input'  → input email (backup) → genera OTP por Resend
//   - 'email-otp'    → tipear OTP de email
type Step = 'idle' | 'wa-waiting' | 'email-input' | 'email-otp'

// Backoff del polling: agresivo al inicio (el usuario está atento), suaviza después.
function pollIntervalMs(elapsedMs: number): number {
  if (elapsedMs < 30_000) return 1000
  if (elapsedMs < 60_000) return 3000
  return 5000
}

const POLL_TIMEOUT_MS = 10 * 60 * 1000

export function LoginForm({ invitedName = null }: { invitedName?: string | null }) {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')

  const [step, setStep] = useState<Step>('idle')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // Code del PendingAuth abierto (solo durante 'wa-waiting').
  const [waCode, setWaCode] = useState<string | null>(null)
  const [waStartedAt, setWaStartedAt] = useState<number | null>(null)
  // Ref para cancelar el ciclo de polling si el usuario vuelve al idle.
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)

  // --- Polling del estado del PendingAuth -----------------------------------

  const stopPolling = useCallback(() => {
    cancelledRef.current = true
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const finishWithSignIn = useCallback(
    async (code: string) => {
      // Destino resuelto en el server: Cuadros, u onboarding si la cuenta es nueva
      // (también consume la invitación si aplica).
      let destination: string
      try {
        const res = await signIn('whatsapp', { code, redirect: false })
        if (res?.error) throw new Error(res.error)
        destination = await afterLoginAction()
      } catch {
        toast.error('No pudimos completar el login. Probá de nuevo.')
        setStep('idle')
        setWaCode(null)
        setWaStartedAt(null)
        return
      }
      // Navegación dura, NO router.push + router.refresh: la respuesta de la server
      // action + el refresh cancelaban la transición del push en pleno commit y la
      // pantalla quedaba clavada en "Esperando tu mensaje" con la sesión ya creada.
      window.location.href = callbackUrl || destination
    },
    [callbackUrl],
  )

  useEffect(() => {
    if (step !== 'wa-waiting' || !waCode || !waStartedAt) return
    cancelledRef.current = false

    async function tick() {
      if (cancelledRef.current) return
      const elapsed = Date.now() - waStartedAt!
      if (elapsed > POLL_TIMEOUT_MS) {
        toast.error('El código expiró. Probá de nuevo.')
        setStep('idle')
        setWaCode(null)
        setWaStartedAt(null)
        return
      }
      try {
        const res = await fetch(`/api/auth/wa/status?code=${encodeURIComponent(waCode!)}`, {
          cache: 'no-store',
        })
        const data: WaAuthStatus = await res.json()
        if (cancelledRef.current) return
        if (data.status === 'consumed') {
          await finishWithSignIn(waCode!)
          return
        }
        if (data.status === 'rejected') {
          const msg =
            data.reason === 'CODE_EXPIRED'
              ? 'El código expiró. Probá de nuevo.'
              : 'No pudimos verificar el código. Probá de nuevo.'
          toast.error(msg)
          setStep('idle')
          setWaCode(null)
          setWaStartedAt(null)
          return
        }
      } catch {
        // Errores de red transitorios: seguimos polleando hasta el timeout.
      }
      pollTimerRef.current = setTimeout(tick, pollIntervalMs(Date.now() - waStartedAt!))
    }

    pollTimerRef.current = setTimeout(tick, pollIntervalMs(0))
    return () => stopPolling()
  }, [step, waCode, waStartedAt, finishWithSignIn, stopPolling])

  // --- Handlers --------------------------------------------------------------

  async function handleStartWhatsApp() {
    setIsLoading(true)
    const result = await requestWaLoginAction()
    setIsLoading(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    if (!result.data) {
      toast.error('No pudimos iniciar el login.')
      return
    }
    // Abrir WhatsApp en una pestaña nueva y pasar a la pantalla de espera.
    window.open(result.data.waUrl, '_blank', 'noopener,noreferrer')
    setWaCode(result.data.code)
    setWaStartedAt(Date.now())
    setStep('wa-waiting')
  }

  function handleBackToIdle() {
    stopPolling()
    setStep('idle')
    setWaCode(null)
    setWaStartedAt(null)
    setEmail('')
    setOtp('')
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    const normalized = email.trim().toLowerCase()
    const result = await requestOtpAction(normalized)
    setIsLoading(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setEmail(normalized)
    setStep('email-otp')
    toast.success('Te enviamos un código a tu email.')
  }

  async function handleEmailOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6) return
    setIsLoading(true)
    const result = await signIn('email', { email, otp, redirect: false })
    setIsLoading(false)
    if (result?.error) {
      toast.error('Código inválido o vencido.')
      setOtp('')
      return
    }
    const destination = await afterLoginAction()
    // Navegación dura por la misma race que en finishWithSignIn.
    window.location.href = callbackUrl || destination
  }

  // --- Render ---------------------------------------------------------------

  if (step === 'idle') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold">
            {invitedName ? 'Creá tu cuenta' : 'Iniciá sesión'}
          </CardTitle>
          <CardDescription className="text-center">
            {invitedName
              ? `${invitedName}, tu cuenta se crea con WhatsApp: mandás un mensaje y listo. Sin contraseña.`
              : 'Usamos WhatsApp como puerta principal. Sin contraseña.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            size="lg"
            disabled={isLoading}
            onClick={handleStartWhatsApp}
          >
            {isLoading ? 'Generando…' : 'Continuar con WhatsApp'}
          </Button>
          {/* Invitado nuevo: sin el link a email — solo loguea cuentas existentes
              con email verificado, sería un camino que termina en error. */}
          {!invitedName && (
            <div className="text-center">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground cursor-pointer text-sm underline-offset-2 hover:underline"
                onClick={() => setStep('email-input')}
                disabled={isLoading}
              >
                No puedo usar WhatsApp ahora
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (step === 'wa-waiting') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold">Esperando tu mensaje</CardTitle>
          <CardDescription className="text-center">
            Abrimos WhatsApp en otra pestaña. Enviá el mensaje sin editarlo y volvemos a esta página solos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-center font-mono text-sm">
            Código: {waCode}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleBackToIdle}
          >
            Cancelar
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (step === 'email-input') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold">Iniciar con email</CardTitle>
          <CardDescription className="text-center">
            Te enviamos un código de acceso. Solo funciona si verificaste tu email antes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !email}>
              {isLoading ? 'Enviando…' : 'Continuar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleBackToIdle}
              disabled={isLoading}
            >
              Volver
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  // step === 'email-otp'
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-center text-2xl font-bold">Verificar código</CardTitle>
        <CardDescription className="text-center">
          Ingresá el código de 6 dígitos enviado a {email}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEmailOtpSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="block text-center">Código de verificación</Label>
            <InputOTP
              containerClassName="justify-center"
              maxLength={6}
              value={otp}
              onChange={setOtp}
              disabled={isLoading}
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
          <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
            {isLoading ? 'Verificando…' : 'Verificar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStep('email-input')
              setOtp('')
            }}
            disabled={isLoading}
          >
            Volver al email
          </Button>
        </form>
        <p className="text-muted-foreground mt-4 text-center text-xs">
          <Link href="/" className="underline-offset-2 hover:underline">
            Volver al inicio
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

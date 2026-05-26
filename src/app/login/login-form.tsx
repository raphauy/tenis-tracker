'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { getPostLoginUrl } from '@/lib/auth-redirect'
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
import { requestOtpAction } from './actions'

type Step = 'email' | 'otp'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  // El backend hace upsert: registrarse e iniciar sesión son el mismo flujo. El
  // `mode` solo cambia el copy, según el botón de la landing que trajo al usuario.
  const isSignup = searchParams.get('mode') === 'signup'

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
    setStep('otp')
    toast.success('Te enviamos un código a tu email.')
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6) return
    setIsLoading(true)
    const result = await signIn('credentials', { email, otp, redirect: false })
    setIsLoading(false)
    if (result?.error) {
      toast.error('Código inválido o vencido.')
      setOtp('')
      return
    }
    // Destino: callbackUrl si vino del proxy, si no la raíz (el proxy redirige a /[slug] u /onboarding).
    router.push(callbackUrl || getPostLoginUrl())
    router.refresh()
  }

  function handleBackToEmail() {
    setStep('email')
    setOtp('')
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-center text-2xl font-bold">
          {step === 'email'
            ? isSignup
              ? 'Creá tu cuenta'
              : 'Iniciá sesión'
            : 'Verificar código'}
        </CardTitle>
        <CardDescription className="text-center">
          {step === 'email'
            ? 'Ingresá tu email para recibir un código de acceso'
            : `Ingresá el código de 6 dígitos enviado a ${email}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'email' ? (
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
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-center block">Código de verificación</Label>
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
              onClick={handleBackToEmail}
              disabled={isLoading}
            >
              Volver al email
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

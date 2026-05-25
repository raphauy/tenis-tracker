'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { requestOtpAction } from './actions'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/app'

  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const normalized = email.trim().toLowerCase()
    const result = await requestOtpAction(normalized)
    setLoading(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setEmail(normalized)
    setStep('otp')
    toast.success('Te enviamos un código a tu email.')
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6) return
    setLoading(true)
    const result = await signIn('credentials', { email, otp, redirect: false })
    setLoading(false)
    if (result?.error) {
      toast.error('Código inválido o vencido.')
      setOtp('')
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  if (step === 'email') {
    return (
      <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <Button type="submit" disabled={loading || !email}>
          {loading ? 'Enviando…' : 'Enviar código'}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <Label htmlFor="otp">Código de verificación</Label>
        <p className="text-sm text-muted-foreground text-center">
          Enviado a {email}
        </p>
        <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
          <InputOTPGroup>
            {Array.from({ length: 6 }).map((_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button type="submit" disabled={loading || otp.length !== 6}>
        {loading ? 'Verificando…' : 'Entrar'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setStep('email')
          setOtp('')
        }}
      >
        Cambiar email
      </Button>
    </form>
  )
}

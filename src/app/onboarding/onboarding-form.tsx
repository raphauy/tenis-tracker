'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckIcon, XIcon, Loader2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { slugify } from '@/lib/slug'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { checkSlugAvailability, completeOnboarding, type SlugStatus } from './actions'

type Status = 'idle' | 'checking' | SlugStatus

const MESSAGES: Record<Exclude<Status, 'idle'>, string> = {
  checking: 'Verificando…',
  available: 'Disponible',
  taken: 'Ya está en uso',
  reserved: 'Ese link está reservado',
  invalid: 'Entre 3 y 30 caracteres: letras, números y guiones',
}

export function OnboardingForm({ initialName, appHost }: { initialName: string; appHost: string }) {
  const router = useRouter()
  const [name, setName] = React.useState(initialName)
  const [slug, setSlug] = React.useState(() => slugify(initialName))
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [status, setStatus] = React.useState<Status>('idle')
  const [submitting, setSubmitting] = React.useState(false)

  const latestSlug = React.useRef(slug)
  React.useEffect(() => {
    latestSlug.current = slug
  }, [slug])

  // Autosugerir el slug desde el nombre mientras no se haya editado a mano.
  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  // Live-check con debounce; descarta respuestas viejas (race de red).
  React.useEffect(() => {
    const current = slug
    if (!current) {
      setStatus('idle')
      return
    }
    setStatus('checking')
    const timer = setTimeout(async () => {
      const res = await checkSlugAvailability(current)
      if (latestSlug.current !== current) return // stale
      setStatus(res.success ? res.data!.status : 'idle')
    }, 400)
    return () => clearTimeout(timer)
  }, [slug])

  const canSubmit = status === 'available' && name.trim().length > 0 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const res = await completeOnboarding({ name: name.trim(), slug })
    setSubmitting(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    // Solo push: NO router.refresh() — refrescaría /onboarding, que ahora redirige al slug
    // (el usuario ya lo tiene) y eso aborta la navegación ("unexpected response").
    router.push(`/${res.data!.slug}`)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Elegí tu link</CardTitle>
        <CardDescription>
          Así te van a encontrar. Tu nombre se puede cambiar después; el link queda fijo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              maxLength={100}
              required
              autoFocus
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Tu link</Label>
            <div className="flex items-center rounded-md border bg-muted/40 pl-3 focus-within:ring-2 focus-within:ring-ring">
              <span className="shrink-0 text-sm text-muted-foreground">{appHost}/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }}
                placeholder="tu-nombre"
                maxLength={30}
                disabled={submitting}
                className="border-0 bg-transparent pl-1 shadow-none focus-visible:ring-0"
                aria-invalid={status === 'taken' || status === 'reserved' || status === 'invalid'}
              />
            </div>
            {status !== 'idle' && (
              <p
                className={cn(
                  'flex items-center gap-1.5 text-sm',
                  status === 'available' && 'text-emerald-600 dark:text-emerald-500',
                  status === 'checking' && 'text-muted-foreground',
                  (status === 'taken' || status === 'reserved' || status === 'invalid') &&
                    'text-destructive'
                )}
              >
                {status === 'checking' && <Loader2Icon className="size-3.5 animate-spin" />}
                {status === 'available' && <CheckIcon className="size-3.5" />}
                {(status === 'taken' || status === 'reserved' || status === 'invalid') && (
                  <XIcon className="size-3.5" />
                )}
                {MESSAGES[status]}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {submitting ? 'Guardando…' : 'Continuar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

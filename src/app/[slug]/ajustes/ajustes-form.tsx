'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Visibility } from '@prisma/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ImageUpload } from '@/components/shared/image-upload'
import { GeneratedAvatar } from '@/components/generated-avatar'
import { uploadAvatarAction, updateProfileAction } from './actions'

export function AjustesForm({
  userId,
  slug,
  appHost,
  email,
  initialName,
  initialImage,
  initialVisibility,
}: {
  userId: string
  slug: string
  appHost: string
  email: string
  initialName: string
  initialImage: string | null
  initialVisibility: Visibility
}) {
  const router = useRouter()
  const [name, setName] = React.useState(initialName)
  const [image, setImage] = React.useState<string | null>(initialImage)
  const [isPublic, setIsPublic] = React.useState(initialVisibility === 'PUBLIC')
  const [saving, setSaving] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await updateProfileAction({
      name: name.trim(),
      image,
      visibility: isPublic ? 'PUBLIC' : 'PRIVATE',
    })
    setSaving(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success('Perfil actualizado')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Foto */}
      <div className="flex flex-col items-center gap-3">
        <ImageUpload
          value={image}
          onChange={setImage}
          onError={(msg) => toast.error(msg)}
          upload={uploadAvatarAction}
          disabled={saving}
          className="size-32"
          fallback={<GeneratedAvatar seed={userId} title="Tu avatar actual" />}
        />
        <p className="text-sm text-muted-foreground">
          Hacé clic o arrastrá una imagen para cambiar tu foto · JPG o PNG, hasta 4 MB
        </p>
      </div>

      {/* Nombre */}
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          disabled={saving}
        />
      </div>

      {/* Email read-only */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} disabled className="bg-muted/40" />
        <p className="text-xs text-muted-foreground">El email no se puede cambiar.</p>
      </div>

      {/* Link (slug) read-only */}
      <div className="space-y-2">
        <Label>Tu link</Label>
        <div className="flex items-center rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {appHost}/<span className="text-foreground">{slug}</span>
        </div>
        <p className="text-xs text-muted-foreground">El link es fijo y no se puede cambiar.</p>
      </div>

      {/* Visibilidad */}
      <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="visibility">Perfil público</Label>
          <p className="text-sm text-muted-foreground">
            {isPublic
              ? 'Cualquiera con el link puede ver tu carrera.'
              : 'Solo vos podés ver tu perfil.'}
          </p>
        </div>
        <Switch id="visibility" checked={isPublic} onCheckedChange={setIsPublic} disabled={saving} />
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-3">
        <Link
          href={`/${slug}`}
          className={buttonVariants({ variant: 'outline' })}
          aria-disabled={saving}
        >
          Volver
        </Link>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

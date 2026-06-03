'use client'

import * as React from 'react'
import { ImagePlusIcon, XIcon, Loader2Icon, UploadIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/lib/types'

type Props = {
  value: string | null
  onChange: (url: string | null) => void
  onError?: (message: string) => void
  // Server action que sube el archivo y devuelve la URL.
  upload: (formData: FormData) => Promise<ActionResult<{ url: string }>>
  disabled?: boolean
  className?: string // tamaño del círculo, ej. "size-36"
  // Contenido a mostrar en el estado vacío (ej. el avatar identicon actual). Sigue siendo
  // clickeable/droppable: al hover aparece la acción de subir foto encima.
  fallback?: React.ReactNode
}

// Avatar circular con carga por clic o drag & drop, y badge para quitar. Replica el patrón de OnMind.
export function ImageUpload({ value, onChange, onError, upload, disabled, className, fallback }: Props) {
  const [isUploading, setIsUploading] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const doUpload = React.useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        onError?.('El archivo debe ser una imagen')
        return
      }
      setIsUploading(true)
      const fd = new FormData()
      fd.append('file', file)
      const res = await upload(fd)
      setIsUploading(false)
      if (!res.success) {
        onError?.(res.error)
        return
      }
      onChange(res.data!.url)
    },
    [upload, onChange, onError]
  )

  function openPicker() {
    if (!disabled && !isUploading) inputRef.current?.click()
  }

  return (
    <div className={cn('relative shrink-0 rounded-full', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        disabled={disabled || isUploading}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) doUpload(f)
        }}
      />

      {value ? (
        <div className="relative size-full overflow-hidden rounded-full border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Foto de perfil" className="size-full object-cover" />
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 size-7 cursor-pointer rounded-full shadow"
              onClick={() => onChange(null)}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Quitar foto</span>
            </Button>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') openPicker()
          }}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            const f = e.dataTransfer.files?.[0]
            if (f && !disabled && !isUploading) doUpload(f)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setIsDragging(false)
          }}
          className={cn(
            'group/upload relative flex size-full flex-col items-center justify-center overflow-hidden rounded-full text-muted-foreground transition-colors',
            fallback ? 'border' : 'border-2 border-dashed',
            isDragging
              ? 'border-primary bg-primary/5 text-primary'
              : !fallback && 'hover:bg-muted/50',
            !disabled && !isUploading && 'cursor-pointer',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {fallback && <div className="absolute inset-0">{fallback}</div>}
          <div
            className={cn(
              'relative z-10 flex items-center justify-center',
              fallback &&
                'size-full bg-background/0 opacity-0 transition group-hover/upload:bg-background/50 group-hover/upload:opacity-100',
              fallback && (isUploading || isDragging) && 'bg-background/50 opacity-100'
            )}
          >
            {isUploading ? (
              <Loader2Icon className="size-6 animate-spin" />
            ) : isDragging ? (
              <UploadIcon className="size-6" />
            ) : (
              <ImagePlusIcon className="size-6" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { Avatar, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@/components/ui/dialog'

// Avatar del dueño del Perfil: clickeable, abre un Dialog con la foto en grande.
// Solo se renderiza cuando hay imagen (sin foto, el header muestra solo el nombre).
export function OwnerAvatar({ image, name }: { image: string; name: string }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Ver foto de ${name}`}
            className="cursor-pointer rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Avatar size="lg">
          <AvatarImage src={image} alt={name} />
        </Avatar>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md [&_[data-slot=dialog-close]]:bg-background/70 [&_[data-slot=dialog-close]]:shadow-sm [&_[data-slot=dialog-close]]:backdrop-blur-sm [&_[data-slot=dialog-close]]:hover:bg-background">
        <DialogTitle className="sr-only">Foto de {name}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={name}
          className="mx-auto max-h-[70vh] w-full rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}

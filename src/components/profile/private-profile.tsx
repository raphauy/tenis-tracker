import { LockIcon } from 'lucide-react'

// Se muestra a un tercero cuando el Perfil es privado: revela el nombre, oculta el contenido.
export function PrivateProfile({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <LockIcon className="size-8 text-muted-foreground" />
      <p className="text-muted-foreground">
        El perfil de <span className="font-medium text-foreground">{name}</span> es privado.
      </p>
    </div>
  )
}

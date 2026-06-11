import { OwnerAvatar } from '@/components/profile/owner-avatar'

// Encabezado del Perfil: identidad del dueño (avatar + nombre). La navegación y la cuenta
// del visitante viven en el AppHeader global del layout.
// El CTA "+ Nuevo torneo" vive junto al buscador (ver TimelineList), no acá.
export function ProfileHeader({
  ownerId,
  ownerName,
  ownerImage,
}: {
  ownerId: string
  ownerName: string
  ownerImage: string | null
}) {
  return (
    <header className="mb-8 flex min-w-0 items-center gap-3">
      <OwnerAvatar image={ownerImage} seed={ownerId} name={ownerName} />
      <h1 className="truncate text-2xl font-semibold tracking-tight">{ownerName}</h1>
    </header>
  )
}

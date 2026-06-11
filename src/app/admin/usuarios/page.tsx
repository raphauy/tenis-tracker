import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { getUsersAdmin } from '@/services/user-service'
import { getInvitationsAdmin } from '@/services/invitation-service'
import { UsuariosPanel } from './usuarios-panel'

export const metadata = { title: 'Usuarios · Tenis Tracker' }

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}

async function PanelData() {
  const [users, invitations] = await Promise.all([getUsersAdmin(), getInvitationsAdmin()])
  return <UsuariosPanel users={users} invitations={invitations} />
}

export default function AdminUsuariosPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Los usuarios registrados y las invitaciones enviadas a potenciales usuarios.
        </p>
      </header>
      <Suspense fallback={<PanelSkeleton />}>
        <PanelData />
      </Suspense>
    </main>
  )
}

import Link from 'next/link'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getViewerChrome } from '@/services/user-service'
import { UserAvatar } from '@/components/user-avatar'
import { AdminNav } from '@/components/admin/admin-nav'

// Cubre todo /admin/*: nunca se indexa.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// El acceso (solo SUPERADMIN) ya lo garantiza src/proxy.ts.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const viewer = session?.user ? await getViewerChrome(session.user.id) : null

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-heading font-semibold tracking-tight">
            Tenis Tracker
          </Link>
          {viewer && (
            <UserAvatar
              name={viewer.name}
              email={viewer.email}
              image={viewer.image}
              slug={viewer.slug}
              role={viewer.role}
            />
          )}
        </div>
      </header>
      <AdminNav />
      {children}
    </div>
  )
}

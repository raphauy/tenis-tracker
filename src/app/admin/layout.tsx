import type { Metadata } from 'next'
import { AppHeader } from '@/components/app-header'
import { AdminNav } from '@/components/admin/admin-nav'

// Cubre todo /admin/*: nunca se indexa.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// El acceso (solo SUPERADMIN) ya lo garantiza src/proxy.ts. El banner de email backup
// viene incluido en el shell global (AppHeader).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col pb-14 md:pb-0">
      <AppHeader callbackUrl="/admin" />
      <AdminNav />
      {children}
    </div>
  )
}

import type { Metadata } from 'next'
import { AppHeader } from '@/components/app-header'

export const metadata: Metadata = {
  title: 'Cuadros',
  description:
    'Cuadros de torneos de tenis: brackets en vivo y archivo histórico, en Tenis Tracker.',
}

// Layout público de /cuadros/* (sin auth). Shell de navegación global.
export default function CuadrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col pb-14 md:pb-0">
      <AppHeader callbackUrl="/cuadros" />
      {children}
    </div>
  )
}

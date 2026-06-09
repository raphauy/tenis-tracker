import Link from 'next/link'
import type { Metadata } from 'next'
import { Logo } from '@/components/logo'

export const metadata: Metadata = {
  title: 'Cuadros',
  description:
    'Cuadros de torneos de tenis: brackets en vivo y archivo histórico, en Tenis Tracker.',
}

// Layout público de /cuadros/* (sin auth). Header liviano con el logo.
export default function CuadrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-[100rem] items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Tenis Tracker">
            <Logo />
          </Link>
        </div>
      </header>
      {children}
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRightIcon } from 'lucide-react'
import { getTournamentBySlug } from '@/services/external-bracket-service'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ torneo: string }>
}): Promise<Metadata> {
  const { torneo } = await params
  const t = await getTournamentBySlug(torneo)
  if (!t) return { title: 'Cuadro no encontrado', robots: { index: false, follow: false } }
  return { title: t.name, alternates: { canonical: `/cuadros/${t.slug}` } }
}

export default async function TorneoPage({ params }: { params: Promise<{ torneo: string }> }) {
  const { torneo } = await params
  const t = await getTournamentBySlug(torneo)
  if (!t) notFound()

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/cuadros" className="hover:text-foreground">
          ← Cuadros
        </Link>
      </nav>
      <header className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.name}</h1>
        {t.status === 'ARCHIVED' && <Badge variant="secondary">Finalizado</Badge>}
      </header>

      {t.brackets.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          Este torneo todavía no tiene categorías con cuadro disponible.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {t.brackets.map((b) => (
            <li key={b.id}>
              <Link href={`/cuadros/${t.slug}/${b.slug}`} className="block">
                <Card className="flex-row items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-muted/40">
                  <span className="font-medium">{b.categoryName}</span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

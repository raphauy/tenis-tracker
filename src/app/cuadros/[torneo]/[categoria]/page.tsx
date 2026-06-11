import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getBracketBySlug } from '@/services/external-bracket-service'
import { getFavoriteKeys } from '@/services/favorite-service'
import type { NormalizedBracket } from '@/lib/cuadros/types'
import { Badge } from '@/components/ui/badge'
import { CategoryPills } from '@/components/cuadros/category-pills'
import { BracketView } from '@/components/cuadros/bracket-view'
import { BracketRoundsMobile } from '@/components/cuadros/bracket-rounds-mobile'
import { FavoritesProvider } from '@/components/cuadros/favorites-provider'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ torneo: string; categoria: string }>
}): Promise<Metadata> {
  const { torneo, categoria } = await params
  const res = await getBracketBySlug(torneo, categoria)
  if (!res) return { title: 'Cuadro no encontrado', robots: { index: false, follow: false } }
  return {
    title: `${res.bracket.categoryName} — ${res.tournament.name}`,
    alternates: { canonical: `/cuadros/${res.tournament.slug}/${res.bracket.slug}` },
  }
}

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ torneo: string; categoria: string }>
}) {
  const { torneo, categoria } = await params
  const res = await getBracketBySlug(torneo, categoria)
  if (!res) notFound()

  const { tournament, bracket, siblings } = res
  const data = bracket.data as unknown as NormalizedBracket

  // Favoritos del viewer (si está logueado) para resaltar sus jugadores. Página
  // pública: los anónimos ven la estrella que los manda a login.
  const session = await auth()
  const userId = session?.user?.id ?? null
  const favoriteKeys = userId ? await getFavoriteKeys(userId) : []

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col px-6 py-10">
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/cuadros" className="hover:text-foreground">
          Cuadros
        </Link>
        <span>/</span>
        <Link href={`/cuadros/${tournament.slug}`} className="hover:text-foreground">
          {tournament.name}
        </Link>
      </nav>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{bracket.categoryName}</h1>
        {tournament.status === 'ARCHIVED' && <Badge variant="secondary">Finalizado</Badge>}
      </header>

      {/* Cambiar de categoría sin volver al índice del torneo. */}
      <CategoryPills
        tournamentSlug={tournament.slug}
        categories={siblings}
        activeSlug={bracket.slug}
      />

      {/* Dos layouts: desktop = árbol completo con conectores; mobile = rondas por pestañas. */}
      <FavoritesProvider initialKeys={favoriteKeys} isAuthenticated={!!userId}>
        <div className="hidden lg:block">
          <BracketView bracket={data} />
        </div>
        <div className="lg:hidden">
          <BracketRoundsMobile bracket={data} />
        </div>
      </FavoritesProvider>
    </main>
  )
}

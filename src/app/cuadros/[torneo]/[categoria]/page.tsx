import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getBracketBySlug } from '@/services/external-bracket-service'
import { getFavoriteKeys } from '@/services/favorite-service'
import type { NormalizedBracket } from '@/lib/cuadros/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CategoryPills } from '@/components/cuadros/category-pills'
import { BracketView } from '@/components/cuadros/bracket-view'
import { BracketRoundsMobile } from '@/components/cuadros/bracket-rounds-mobile'
import { FavoritesProvider } from '@/components/cuadros/favorites-provider'
import { StickyChrome } from '@/components/cuadros/sticky-bars'

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

  // Con una sola categoría no hay pills (CategoryPills devuelve null) y en mobile el
  // chrome mide una fila menos: el fallback tiene que acompañar o la barra de rondas
  // arranca despegada hasta que StickyChrome publica el alto real.
  const hasPills = siblings.length >= 2

  return (
    // data-cuadro-chrome-host: acá aterriza --cuadro-chrome-h (fallback del primer
    // paint acá abajo, valor real vía ResizeObserver en StickyChrome).
    <main
      data-cuadro-chrome-host
      className={cn(
        'mx-auto flex w-full max-w-[100rem] flex-1 flex-col px-6 pb-10 lg:[--cuadro-chrome-h:3.5rem]',
        hasPills ? '[--cuadro-chrome-h:6.5rem]' : '[--cuadro-chrome-h:4rem]'
      )}
    >
      {/* Torneo, categoría y pills quedan a la vista mientras se recorre el cuadro. */}
      <StickyChrome>
        <div className="flex flex-col gap-1.5 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="flex min-w-0 flex-col gap-0.5 lg:flex-row lg:items-center lg:gap-2">
            <nav
              aria-label="Miga de pan"
              className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
            >
              <Link href="/cuadros" className="shrink-0 hover:text-foreground">
                Cuadros
              </Link>
              <span aria-hidden>/</span>
              <Link href={`/cuadros/${tournament.slug}`} className="truncate hover:text-foreground">
                {tournament.name}
              </Link>
            </nav>
            <span aria-hidden className="hidden text-muted-foreground/50 lg:inline">
              ·
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-heading text-base font-semibold tracking-tight">
                {bracket.categoryName}
              </h1>
              {tournament.status === 'ARCHIVED' && <Badge variant="secondary">Finalizado</Badge>}
            </div>
          </div>

          {/* Cambiar de categoría sin volver al índice del torneo. */}
          <CategoryPills
            tournamentSlug={tournament.slug}
            categories={siblings}
            activeSlug={bracket.slug}
            className="lg:shrink-0"
          />
        </div>
      </StickyChrome>

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

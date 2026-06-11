import Link from 'next/link'
import { cn } from '@/lib/utils'
import { shortCategoryLabel } from '@/lib/cuadros/category-label'

// Switcher de categorías dentro de un cuadro: una pill por categoría hermana, con su
// etiqueta corta (B · C · D · E · Dobles). En mobile la fila scrollea horizontal con
// edge-bleed (-mx/px). Server component: son solo links. Con una sola categoría no aporta.
export function CategoryPills({
  tournamentSlug,
  categories,
  activeSlug,
}: {
  tournamentSlug: string
  categories: { slug: string; categoryName: string }[]
  activeSlug: string
}) {
  if (categories.length < 2) return null

  return (
    <nav
      aria-label="Categorías del torneo"
      className="-mx-6 mb-6 overflow-x-auto px-6 [scrollbar-width:none]"
    >
      <div className="flex w-max items-center gap-1.5">
        {categories.map((c) => {
          const active = c.slug === activeSlug
          const label = shortCategoryLabel(c.categoryName)
          // Etiquetas de 1–2 caracteres (B, C, 5) → círculo perfecto (ancho = alto); las más
          // largas (Dobles) quedan como pastilla. Ambas con rounded-full.
          const isShort = label.length <= 2
          return (
            <Link
              key={c.slug}
              href={`/cuadros/${tournamentSlug}/${c.slug}`}
              title={c.categoryName}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border text-sm font-medium transition-colors',
                isShort ? 'w-9' : 'px-4',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { shortCategoryLabel } from '@/lib/cuadros/category-label'

// Switcher de categorías dentro de un cuadro: una pill por categoría hermana, con su
// etiqueta corta (B · C · D · E · Dobles). Vive en la barra sticky de contexto: en mobile
// ocupa su propia fila y scrollea horizontal con edge-bleed (-mx/px); en desktop va a la
// derecha del breadcrumb, sin bleed. Server component: son solo links. Con una sola
// categoría no aporta.
export function CategoryPills({
  tournamentSlug,
  categories,
  activeSlug,
  className,
}: {
  tournamentSlug: string
  categories: { slug: string; categoryName: string }[]
  activeSlug: string
  className?: string
}) {
  if (categories.length < 2) return null

  return (
    <nav
      aria-label="Categorías del torneo"
      className={cn(
        '-mx-6 overflow-x-auto px-6 [scrollbar-width:none] lg:mx-0 lg:px-0',
        className
      )}
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
                'inline-flex h-9 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border text-sm font-medium transition-colors lg:h-8',
                isShort ? 'w-9 lg:w-8' : 'px-4 lg:px-3.5',
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

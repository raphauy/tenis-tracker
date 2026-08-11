'use client'

import { useEffect, useRef, type ReactNode, type UIEvent } from 'react'

// Barras pegadas al tope de la vista de un cuadro. El cuadro es largo (un R64 mide
// varias pantallas), así que el contexto —torneo, categoría y ronda— tiene que
// sobrevivir al scroll. El header global NO se hace sticky a propósito: se lo deja
// scrollear para que el alto fijo sea el mínimo (en mobile la BottomNav ya cubre la
// navegación).

// Barra de contexto (breadcrumb · categoría · pills). Publica su alto real en
// `--cuadro-chrome-h` para que las barras de abajo (rondas en desktop, tabs en
// mobile) se apilen sin números mágicos: el nombre del torneo puede pasar a dos
// líneas y cambiar el alto. La var se escribe en el ancestro marcado con
// `data-cuadro-chrome-host` —el mismo que declara el fallback CSS— para que meter un
// wrapper intermedio no la deje huérfana en silencio.
export function StickyChrome({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const host = el?.closest<HTMLElement>('[data-cuadro-chrome-host]') ?? el?.parentElement
    if (!el || !host) return
    const publish = () => host.style.setProperty('--cuadro-chrome-h', `${el.offsetHeight}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="sticky top-0 z-30 -mx-6 border-b bg-background/95 px-6 backdrop-blur"
    >
      {children}
    </div>
  )
}

// Fila de rondas del árbol desktop. Va FUERA del contenedor que scrollea horizontal:
// un `sticky` adentro se anclaría a ese scrollport (overflow-x lo vuelve uno) y nunca
// se dispararía con el scroll de la página. Como queda afuera, hay que replicarle a
// mano el desplazamiento horizontal del cuadro.
export function StickyRounds({ head, children }: { head: ReactNode; children: ReactNode }) {
  const headRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const shiftTo = (scrollLeft: number) => {
    const el = headRef.current
    if (el) el.style.transform = `translateX(${-scrollLeft}px)`
  }

  // El navegador puede restaurar el scrollLeft del cuerpo (back / bfcache) sin emitir
  // un scroll: sin este sync inicial los rótulos arrancarían corridos.
  useEffect(() => {
    if (bodyRef.current) shiftTo(bodyRef.current.scrollLeft)
  }, [])

  return (
    <>
      <div className="sticky top-[var(--cuadro-chrome-h)] z-20 -mx-6 border-b bg-background/95 px-6 backdrop-blur">
        {/* El recorte va acá adentro y no en el sticky: `overflow` corta en el padding
            box, así que con el -mx-6/px-6 de arriba los rótulos asomarían sobre los
            24px de margen donde el cuerpo ya cortó las tarjetas. */}
        <div className="overflow-hidden">
          <div ref={headRef} className="flex min-w-max will-change-transform">
            {head}
          </div>
        </div>
      </div>
      <div
        ref={bodyRef}
        onScroll={(e: UIEvent<HTMLDivElement>) => shiftTo(e.currentTarget.scrollLeft)}
        className="overflow-x-auto pb-4"
      >
        {children}
      </div>
    </>
  )
}

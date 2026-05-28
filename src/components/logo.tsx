import { cn } from '@/lib/utils'

// Pelota de tenis (iconoir:tennis-ball-alt). currentColor → toma el color del padre.
// Stroke 1.5 funciona bien de 32px para arriba.
export function LogoMark({
  className,
  strokeWidth = 1.5,
  ...props
}: React.SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('size-6', className)}
      {...props}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      >
        <path d="M20.66 7c2.762 4.783 1.123 10.899-3.66 13.66S6.101 21.783 3.34 17S2.217 6.1 7 3.34S17.899 2.217 20.66 7" />
        <path d="M21.46 15.242c-4.986-3.302-7.582-7.8-7.538-13.056m-3.844 19.628C9.71 15.844 7.114 11.347 2.54 8.758" />
      </g>
    </svg>
  )
}

// Lockup horizontal: pelota + "Tenis Tracker" en dos tonos.
// Para uso en headers. La altura la define el tamaño del icono.
export function Logo({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 font-sans tracking-tight',
        className,
      )}
    >
      <LogoMark className={cn('size-8 text-primary', iconClassName)} />
      <span className="text-foreground text-2xl font-extrabold leading-none">
        Tenis<span className="text-primary font-bold"> Tracker</span>
      </span>
    </span>
  )
}

// Lockup vertical: pelota arriba centrada + wordmark debajo.
// Para splash/login/landing hero.
export function LogoStacked({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex flex-col items-center gap-4', className)}>
      <LogoMark className="size-20 text-primary" />
      <span className="font-sans text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">
        <span className="text-foreground">Tenis</span>
        <span className="text-primary font-bold"> Tracker</span>
      </span>
    </span>
  )
}

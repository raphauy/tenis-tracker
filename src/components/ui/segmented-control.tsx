'use client'

import { cn } from '@/lib/utils'

// Control segmentado: para elegir entre POCAS opciones (2–4) que conviene tener todas a la
// vista, sin desplegar nada. Para listas largas, usar Select. Semántica de radiogroup.
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  value: T
  onValueChange: (value: T) => void
  options: { value: T; label: string }[]
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'flex w-full rounded-lg border bg-muted/40 p-0.5',
        disabled && 'opacity-50',
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onValueChange(o.value)}
            className={cn(
              'flex-1 cursor-pointer whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:text-sm',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

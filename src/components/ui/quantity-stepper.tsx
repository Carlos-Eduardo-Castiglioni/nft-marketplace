import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
  label: string
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

/** Controle +/- acessível (role=spinbutton) com teclado: setas, Home e End. */
export function QuantityStepper({ value, min = 1, max, onChange, label, size = 'md', disabled, className }: Props) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v))
  const btn = cn(
    'flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:bg-surface-3 disabled:text-subtle',
    size === 'sm' ? 'size-6' : 'size-7',
  )
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={disabled || value <= min} aria-label={`Diminuir ${label}`}>
        <Minus className="size-3.5" strokeWidth={3} />
      </button>
      <span
        role="spinbutton"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        onKeyDown={(e) => {
          if (disabled) return
          const map: Record<string, number> = { ArrowUp: value + 1, ArrowRight: value + 1, ArrowDown: value - 1, ArrowLeft: value - 1, Home: min, End: max }
          if (e.key in map) {
            e.preventDefault()
            onChange(clamp(map[e.key]))
          }
        }}
        className="min-w-6 rounded text-center font-mono text-sm font-semibold tabular"
      >
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={disabled || value >= max} aria-label={`Aumentar ${label}`}>
        <Plus className="size-3.5" strokeWidth={3} />
      </button>
    </div>
  )
}

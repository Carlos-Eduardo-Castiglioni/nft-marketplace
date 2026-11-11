import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '@/lib/utils'

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => <RadioGroupPrimitive.Root ref={ref} className={cn('grid gap-3', className)} {...props} />)
RadioGroup.displayName = 'RadioGroup'

export const RadioDot = ({ checked }: { checked: boolean }) => (
  <span
    aria-hidden
    className={cn(
      'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
      checked ? 'border-primary' : 'border-subtle',
    )}
  >
    {checked && <span className="size-2 rounded-full bg-primary" />}
  </span>
)

/** Item de rádio em formato de "card" (seleção de carteira/provedor). */
export const RadioCard = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & { indicator?: 'start' | 'end' }
>(({ className, children, indicator = 'start', ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'group flex w-full items-center gap-4 rounded-xl border border-transparent bg-surface-2 px-4 py-3 text-left transition-colors hover:border-border data-[state=checked]:border-primary/60 focus-visible:outline-2 focus-visible:outline-ring',
      className,
    )}
    {...props}
  >
    {indicator === 'start' && <Indicator />}
    <div className="min-w-0 flex-1">{children}</div>
    {indicator === 'end' && <Indicator />}
  </RadioGroupPrimitive.Item>
))
RadioCard.displayName = 'RadioCard'

function Indicator() {
  return (
    <span aria-hidden className="flex size-4 shrink-0 items-center justify-center rounded-full border border-subtle group-data-[state=checked]:border-primary">
      <span className="hidden size-2 rounded-full bg-primary group-data-[state=checked]:block" />
    </span>
  )
}

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center font-mono text-[11px] font-semibold uppercase tracking-wide', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground px-2.5 py-1',
      outline: 'rounded-full border border-primary/70 px-2.5 py-0.5 text-primary',
      muted: 'rounded-full bg-surface-3 px-2.5 py-0.5 text-muted',
      success: 'rounded-full bg-success/15 px-2.5 py-0.5 text-success',
      warning: 'rounded-full bg-warning/15 px-2.5 py-0.5 text-warning',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono font-semibold tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-strong',
        gradient: 'bg-copper text-primary-foreground hover:brightness-110',
        outline: 'border border-border bg-transparent text-foreground hover:border-primary hover:text-primary',
        'outline-primary': 'border border-primary/70 text-primary hover:bg-primary/10',
        ghost: 'text-muted hover:bg-surface-2 hover:text-foreground',
        subtle: 'bg-surface-2 text-foreground hover:bg-surface-3',
        link: 'text-primary underline-offset-4 hover:underline px-0',
        destructive: 'bg-destructive text-primary-foreground hover:brightness-110',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-xs',
        default: 'h-10 rounded-md px-4 text-sm',
        lg: 'h-12 rounded-lg px-6 text-sm',
        pill: 'h-12 rounded-full px-8 text-sm',
        icon: 'size-10 rounded-full',
        'icon-sm': 'size-8 rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

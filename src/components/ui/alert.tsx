import { AlertTriangle, Info, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

const icons = { warning: AlertTriangle, error: WifiOff, info: Info }

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  action,
}: {
  variant?: 'warning' | 'error' | 'info'
  title: string
  children?: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  const Icon = icons[variant]
  return (
    <div
      role={variant === 'info' ? 'status' : 'alert'}
      className={cn(
        'flex gap-3 rounded-xl border p-4 text-sm',
        variant === 'warning' && 'border-warning/40 bg-warning/10',
        variant === 'error' && 'border-destructive/40 bg-destructive/10',
        variant === 'info' && 'border-border bg-surface-2',
        className,
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', variant === 'warning' ? 'text-warning' : variant === 'error' ? 'text-destructive' : 'text-primary')} aria-hidden />
      <div className="flex-1 space-y-1">
        <p className="font-mono font-semibold text-foreground">{title}</p>
        {children && <div className="text-muted">{children}</div>}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  )
}

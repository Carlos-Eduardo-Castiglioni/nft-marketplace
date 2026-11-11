import { cn } from '@/lib/utils'

/** Placeholder com shimmer. Sempre receba dimensões explícitas para CLS = 0. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('shimmer rounded-md', className)} {...props} />
}

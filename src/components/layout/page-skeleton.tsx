import { Skeleton } from '@/components/ui/skeleton'

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy="true" aria-label="Carregando página">
      <Skeleton className="mb-4 hidden h-4 w-48 md:block" />
      <Skeleton className="mb-3 size-10 rounded-full md:hidden" />
      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <div className="grid gap-3 md:grid-cols-[4.5rem_1fr]">
          <div className="order-2 flex gap-3 md:order-1 md:flex-col">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-[3.75rem] rounded-md md:size-[4.5rem]" />
            ))}
          </div>
          <Skeleton className="order-1 aspect-square w-full rounded-2xl md:order-2" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-40" />
        </div>
      </div>
    </div>
  )
}

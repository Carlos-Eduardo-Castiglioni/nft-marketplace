import { useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Eth } from '@/components/ui/eth'
import { Skeleton } from '@/components/ui/skeleton'
import { useRelated } from './api'

/** Carrossel horizontal com scroll-snap, navegável por teclado e botões. */
export function NftCarousel({ nftId, title }: { nftId: string; title: string }) {
  const { data, isPending } = useRelated(nftId)
  const scroller = useRef<HTMLUListElement>(null)
  const scroll = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' })
  const headingId = `carousel-${nftId}`

  return (
    <section className="mt-14" aria-labelledby={headingId} aria-roledescription="carrossel">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
        <h2 id={headingId} className="font-mono text-xs font-bold text-primary">
          {title}
        </h2>
        <div className="flex gap-1">
          <button type="button" onClick={() => scroll(-1)} className="rounded-full p-1.5 text-muted hover:text-primary" aria-label="Itens anteriores">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => scroll(1)} className="rounded-full p-1.5 text-muted hover:text-primary" aria-label="Próximos itens">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <ul ref={scroller} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3 [scrollbar-width:thin]">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-36 shrink-0 sm:w-44" aria-hidden>
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="mt-2 h-4 w-3/4" />
                <Skeleton className="mt-1 h-4 w-1/3" />
              </li>
            ))
          : data?.map((n) => (
              <li key={n.id} className="w-36 shrink-0 snap-start sm:w-44">
                <Link to="/nft/$nftId" params={{ nftId: n.id }} className="group block font-mono">
                  <div className="bg-surface p-1.5">
                    <img src={n.thumb} alt="" width={320} height={320} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
                  </div>
                  <p className="mt-2 h-4 truncate text-[11px] leading-4 group-hover:text-primary">{n.name}</p>
                  <Eth value={n.price} className="mt-1 block h-4 text-[11px] font-bold leading-4 text-primary" />
                </Link>
              </li>
            ))}
      </ul>
    </section>
  )
}

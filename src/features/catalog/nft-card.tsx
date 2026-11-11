import { Link } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import type { NftSummary } from '@/lib/api-types'
import { Eth } from '@/components/ui/eth'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAddToCart } from '@/features/cart/api'
import { useToggleFavorite } from './api'

export function NftCard({ nft, priority = false }: { nft: NftSummary; priority?: boolean }) {
  const fav = useToggleFavorite()
  const add = useAddToCart()
  const action =
    'flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground'

  return (
    <article className="group relative" aria-labelledby={`nft-${nft.id}`} data-testid="nft-card">
      <div className="relative overflow-hidden rounded-t-2xl bg-surface p-2 pb-3">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block" tabIndex={-1} aria-hidden>
          <img
            src={nft.thumb}
            alt=""
            width={320}
            height={320}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className="aspect-square w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </Link>
        {nft.rarity && (
          <span className="absolute left-2 top-4 bg-primary px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-primary-foreground">
            {nft.rarity}
          </span>
        )}
        <button
          type="button"
          onClick={() => fav.mutate({ id: nft.id, favorite: !nft.favorite })}
          aria-pressed={nft.favorite}
          aria-label={nft.favorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
          className={cn(
            'absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full border border-primary/60 bg-background/70 text-primary backdrop-blur transition-opacity',
            nft.favorite ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100',
          )}
        >
          <Heart className={cn('size-3.5', nft.favorite && 'fill-primary')} />
        </button>
        <div className="absolute bottom-5 right-4 z-10 hidden gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
          <button
            type="button"
            className={action}
            aria-label={`Adicionar ${nft.name} ao carrinho`}
            onClick={() =>
              add.mutate(
                { nftId: nft.id, editionId: '1/50', quantity: 1 },
                { onSuccess: () => toast.success(`${nft.name} adicionado ao carrinho`) },
              )
            }
          >
            <ShoppingCart className="size-3.5" />
          </button>
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className={action} aria-label={`Ver detalhes de ${nft.name}`}>
            <Search className="size-3.5" />
          </Link>
        </div>
      </div>
      <div className="px-1 pt-2">
        <h3 id={`nft-${nft.id}`} className="h-4 truncate font-mono text-xs leading-4 text-foreground">
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none">
            {nft.name}
          </Link>
        </h3>
        <p className="mt-1 flex h-4 items-baseline gap-2 text-xs leading-4">
          <Eth value={nft.price} className="font-bold text-primary" />
          {nft.previousPrice && (
            <span className="font-mono text-[11px] text-subtle line-through">
              <span className="sr-only">Preço anterior: </span>
              <Eth value={nft.previousPrice} />
            </span>
          )}
        </p>
      </div>
    </article>
  )
}

/** Mesmas dimensões do card real: imagem quadrada + 2 linhas de texto → CLS zero. */
export function NftCardSkeleton() {
  return (
    <div aria-hidden data-testid="nft-card-skeleton">
      <div className="rounded-t-2xl bg-surface p-2 pb-3">
        <Skeleton className="aspect-square w-full rounded-xl" />
      </div>
      <div className="px-1 pt-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-1 h-4 w-1/3" />
      </div>
    </div>
  )
}

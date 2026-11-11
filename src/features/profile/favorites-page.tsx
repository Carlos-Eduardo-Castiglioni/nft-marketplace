import { Skeleton } from '@/components/ui/skeleton'
import { useFavorites } from '@/features/catalog/api'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'

export function FavoritesPage() {
  const { data, isPending } = useFavorites()
  return (
    <section aria-labelledby="fav-title">
      <h1 id="fav-title" className="mb-5 text-xs font-bold">
        Lista de interesse
      </h1>
      {isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      ) : !data?.length ? (
        <p className="rounded-xl bg-surface p-8 text-center text-xs text-muted">Você ainda não favoritou nenhum NFT.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
          {data.map((n) => (
            <NftCard key={n.id} nft={n} />
          ))}
        </div>
      )}
      <Skeleton className="hidden" />
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Heart, Link2, Mail, Share2, ShoppingCart, Star } from 'lucide-react'
import { toast } from 'sonner'
import type { EditionId, NftDetail } from '@/lib/api-types'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Eth } from '@/components/ui/eth'
import { QuantityStepper } from '@/components/ui/quantity-stepper'
import { Alert } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { NotFoundPage } from '@/components/layout/status-pages'
import { cn } from '@/lib/utils'
import { useAddToCart, useCart } from '@/features/cart/api'
import { useRealtime } from '@/features/realtime/realtime'
import { useNft, useToggleFavorite } from './api'
import { NftCarousel } from './nft-carousel'

export function NftDetailPage() {
  const { nftId } = useParams({ from: '/nft/$nftId' })
  const query = useNft(nftId)

  if (query.isPending) return <PageSkeleton />
  if (query.isError) {
    if (query.error.status === 404) return <NotFoundPage />
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Alert
          variant="error"
          title="Não foi possível carregar este NFT"
          action={
            <Button size="sm" onClick={() => query.refetch()} loading={query.isFetching}>
              Tentar novamente
            </Button>
          }
        >
          {query.error.message}
        </Alert>
      </div>
    )
  }
  return <NftDetailView key={nftId} nft={query.data} />
}

function NftDetailView({ nft }: { nft: NftDetail }) {
  const router = useRouter()
  const navigate = useNavigate()
  const { data: cart } = useCart()
  const add = useAddToCart()
  const fav = useToggleFavorite()
  const { lastNftEvent } = useRealtime()

  const defaultEdition = nft.editions.find((e) => e.id === '1/50' && e.stock > 0) ?? nft.editions.find((e) => e.stock > 0) ?? nft.editions[0]
  const [editionId, setEditionId] = useState<EditionId>(defaultEdition.id)
  const [qty, setQty] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const edition = nft.editions.find((e) => e.id === editionId)!

  const inCart = cart?.lines.find((l) => l.nftId === nft.id && l.editionId === editionId)?.quantity ?? 0
  const limit = Math.max(0, Math.min(edition.stock, edition.maxPerOrder) - inCart)
  const soldOut = edition.stock === 0
  useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, limit || 1)))
  }, [limit])

  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (lastNftEvent?.id === nft.id) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 2500)
      return () => clearTimeout(t)
    }
  }, [lastNftEvent, nft.id])

  const limitMessage = useMemo(() => {
    if (soldOut) return 'Edição esgotada.'
    if (limit === 0) return `Você já tem o máximo permitido desta edição no carrinho (${inCart}).`
    if (qty >= limit) return `Limite de ${limit} unidade(s) por pedido para esta edição.`
    return null
  }, [soldOut, limit, qty, inCart])

  const addToCart = (goToCart: boolean) =>
    add.mutate(
      { nftId: nft.id, editionId, quantity: qty },
      {
        onSuccess: () => {
          toast.success(`${nft.name} (${edition.label}) adicionado ao carrinho`)
          if (goToCart) navigate({ to: '/cart' })
        },
      },
    )

  const disabled = soldOut || limit === 0
  const price = edition.price

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 md:pb-8 md:pt-6">
      <div className="hidden md:block">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/market' }, { label: nft.name }]} />
      </div>

      {/* top bar mobile (voltar / favoritar) */}
      <div className="mb-3 flex items-center justify-between md:hidden">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.history.back() : navigate({ to: '/' }))}
          className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-primary"
          aria-label="Voltar"
        >
          <ChevronLeft className="size-4" />
        </button>
        <FavButton nft={nft} onToggle={() => fav.mutate({ id: nft.id, favorite: !nft.favorite })} />
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:gap-10">
        {/* Galeria */}
        <div className="grid gap-3 md:grid-cols-[4.5rem_1fr]">
          <ul className="order-2 flex gap-3 md:order-1 md:flex-col" aria-label="Miniaturas">
            {nft.gallery.map((src, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
                  aria-current={activeImage === i}
                  className={cn('block overflow-hidden rounded-md border-2 transition-colors', activeImage === i ? 'border-primary' : 'border-transparent hover:border-border')}
                >
                  <img src={src.replace('640', '320')} alt="" width={72} height={72} className="size-14 object-cover md:size-[4.25rem]" />
                </button>
              </li>
            ))}
          </ul>
          <div className="order-1 md:order-2">
            <img
              src={nft.gallery[activeImage]}
              alt={`${nft.name} — imagem ${activeImage + 1}`}
              width={640}
              height={640}
              fetchPriority="high"
              className="aspect-square w-full rounded-2xl object-cover"
            />
          </div>
        </div>

        {/* Informações + compra */}
        <div className="font-mono">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-lg font-bold sm:text-xl">{nft.name}</h1>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/60 px-2 py-0.5 text-xs" aria-label={`Avaliação ${nft.rating} de 5, ${nft.reviewsCount} avaliações`}>
              <Star className="size-3 fill-foreground" aria-hidden /> {nft.rating}
              <span className="text-muted">({nft.reviewsCount})</span>
            </span>
          </div>
          <p
            className={cn('mt-1 inline-block rounded text-sm font-bold text-primary transition-shadow', flash && 'animate-pulse-ring')}
            data-testid="detail-price"
            aria-live="polite"
          >
            <Eth value={price} />
            {nft.previousPrice && flash && <span className="ml-2 text-xs text-subtle line-through"><Eth value={nft.previousPrice} /></span>}
          </p>

          <h2 className="mt-5 text-xs font-bold">Sobre este NFT:</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{nft.description}</p>

          <fieldset className="mt-5">
            <legend className="text-xs font-bold">Edição:</legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Edição">
              {nft.editions.map((e) => {
                const selected = e.id === editionId
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={e.stock === 0}
                    onClick={() => {
                      setEditionId(e.id)
                      setQty(1)
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return
                      const enabled = nft.editions.filter((x) => x.stock > 0)
                      const idx = enabled.findIndex((x) => x.id === editionId)
                      const next = enabled[(idx + (ev.key === 'ArrowRight' ? 1 : enabled.length - 1)) % enabled.length]
                      setEditionId(next.id)
                      setQty(1)
                      ;(ev.currentTarget.parentElement?.querySelector(`[data-edition="${next.id}"]`) as HTMLElement | null)?.focus()
                    }}
                    tabIndex={selected ? 0 : -1}
                    data-edition={e.id}
                    className={cn(
                      'rounded-full border px-3 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40',
                      selected ? 'border-primary text-primary' : 'border-border text-foreground hover:border-primary/60',
                    )}
                  >
                    {e.label}
                    <span className="sr-only">
                      {' '}
                      — {e.stock === 0 ? 'esgotada' : `${e.stock} disponíveis`}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="mt-5 hidden items-center gap-6 md:flex">
            <QuantityStepper label="Quantidade" value={qty} max={Math.max(1, limit)} onChange={setQty} disabled={disabled} />
            <Button size="sm" className="px-6" onClick={() => addToCart(true)} disabled={disabled} loading={add.isPending}>
              COMPRAR
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={nft.favorite}
              onClick={() => fav.mutate({ id: nft.id, favorite: !nft.favorite })}
              className="gap-1.5 border-primary/60 text-xs"
            >
              <Heart className={cn('size-3.5', nft.favorite && 'fill-primary text-primary')} /> {nft.favorite ? 'Favoritado' : 'Favoritar'}
            </Button>
          </div>
          {limitMessage && (
            <p className="mt-2 text-xs text-warning" role="status" data-testid="qty-limit">
              {limitMessage}
            </p>
          )}
          <p className="mt-1 text-[11px] text-subtle">
            {edition.stock > 0 ? `${edition.stock} disponíveis · máx. ${edition.maxPerOrder} por pedido` : 'Sem estoque'}
          </p>

          <dl className="mt-5 space-y-2 text-[13px] text-muted">
            <div>
              <dt className="inline">ID do token: </dt>
              <dd className="inline">#{nft.tokenId}</dd>
            </div>
            <div>
              <dt className="inline">Coleção: </dt>
              <dd className="inline">{nft.series}</dd>
            </div>
            <div>
              <dt className="inline">Atributos: </dt>
              <dd className="inline">{nft.attributes.join(', ')}</dd>
            </div>
          </dl>
          <div className="mt-4 hidden items-center gap-2 text-xs font-bold md:flex">
            Compartilhar este NFT:
            <a href="#" onClick={(e) => e.preventDefault()} aria-label="Copiar link" className="hover:text-primary"><Link2 className="size-3.5" /></a>
            <a href="#" onClick={(e) => e.preventDefault()} aria-label="Compartilhar por e-mail" className="hover:text-primary"><Mail className="size-3.5" /></a>
            <a href="#" onClick={(e) => e.preventDefault()} aria-label="Compartilhar" className="hover:text-primary"><Share2 className="size-3.5" /></a>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details" className="mt-12 font-mono">
        <TabsList>
          <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
          <TabsTrigger value="reviews">Avaliações de colecionadores ({nft.reviewsCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="space-y-4 pt-4 text-[13px] leading-relaxed text-muted">
          {nft.longDescription.map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
          <div>
            <h3 className="text-xs font-bold text-foreground">Rede:</h3>
            <p>Cunhado na {nft.network === 'ethereum' ? 'Ethereum' : nft.network === 'polygon' ? 'Polygon' : 'Solana'} com procedência imutável e metadados armazenados no IPFS.</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Direitos autorais:</h3>
            <p>Direitos autorais do criador: {nft.royalties}, pagos automaticamente pelos mercados compatíveis.</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Contrato:</h3>
            <p>{nft.contract} • Contrato inteligente ERC-721 verificado.</p>
          </div>
        </TabsContent>
        <TabsContent value="reviews" className="pt-4">
          <ul className="space-y-3">
            {nft.reviews.map((r) => (
              <li key={r.id} className="rounded-xl bg-surface p-4 text-[13px]">
                <p className="flex items-center gap-2 font-bold">
                  {r.author}
                  <span className="text-primary" aria-label={`${r.rating} de 5 estrelas`}>
                    {'★'.repeat(r.rating)}
                  </span>
                </p>
                <p className="mt-1 text-muted">{r.text}</p>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <NftCarousel nftId={nft.id} title="Mais desta coleção" />

      {/* barra de compra fixa mobile (Figma) */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface px-4 py-3 md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between font-mono">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">Qtd.</span>
            <QuantityStepper label="Quantidade" size="sm" value={qty} max={Math.max(1, limit)} onChange={setQty} disabled={disabled} />
          </div>
          <Eth value={price} className="text-lg font-bold text-primary" />
        </div>
        <div className="mx-auto mt-3 flex max-w-md gap-3">
          <Button variant="gradient" size="pill" className="flex-1" onClick={() => addToCart(true)} disabled={disabled} loading={add.isPending}>
            Comprar NFT
          </Button>
          <Button variant="subtle" size="icon" className="size-12 text-primary" aria-label="Adicionar ao carrinho" onClick={() => addToCart(false)} disabled={disabled}>
            <ShoppingCart className="size-4" />
          </Button>
        </div>
      </div>
      <p className="sr-only">
        <Link to="/cart">Ir para o carrinho</Link>
      </p>
    </div>
  )
}

function FavButton({ nft, onToggle }: { nft: NftDetail; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={nft.favorite}
      aria-label={nft.favorite ? 'Remover dos favoritos' : 'Favoritar'}
      className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-primary"
    >
      <Heart className={cn('size-4', nft.favorite && 'fill-primary')} />
    </button>
  )
}

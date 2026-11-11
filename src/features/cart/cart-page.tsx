import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Trash2 } from 'lucide-react'
import type { Cart, CartLine } from '@/lib/api-types'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Eth } from '@/components/ui/eth'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert } from '@/components/ui/alert'
import { QuantityStepper } from '@/components/ui/quantity-stepper'
import { lineTotal } from '@/lib/cart-math'
import { cn } from '@/lib/utils'
import { useSession } from '@/features/auth/api'
import { useAuthDialog } from '@/features/auth/auth-dialog'
import { NftCarousel } from '@/features/catalog/nft-carousel'
import { useCart, useRemoveLine, useUpdateQuantity } from './api'
import { CouponForm, PriceChangeAlert, Totals } from './cart-summary'

export function CartPage() {
  const query = useCart()
  const router = useRouter()

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 md:pt-6">
      <div className="hidden md:block">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/market' }, { label: 'Carrinho' }]} />
      </div>
      <div className="mb-4 flex items-center gap-4 md:hidden">
        <button type="button" onClick={() => router.history.back()} className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-primary" aria-label="Voltar">
          <ChevronLeft className="size-4" />
        </button>
        <h1 className="font-mono text-base font-bold">Carrinho de NFTs</h1>
      </div>
      <h1 className="mb-4 hidden font-mono text-base font-bold md:block">Carrinho</h1>

      {query.isPending ? (
        <CartSkeleton />
      ) : query.isError ? (
        <Alert variant="error" title="Não foi possível carregar seu carrinho" action={<Button size="sm" onClick={() => query.refetch()}>Tentar novamente</Button>}>
          {query.error.message}
        </Alert>
      ) : query.data.lines.length === 0 ? (
        <EmptyCart />
      ) : (
        <CartContent cart={query.data} />
      )}

      <NftCarousel nftId="emerald-ape-042" title="Colecionadores também viram" />
    </div>
  )
}

function CartContent({ cart }: { cart: Cart }) {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const auth = useAuthDialog()
  const finalize = () => {
    if (session) navigate({ to: '/checkout' })
    else auth.open('login', { onSuccess: () => navigate({ to: '/checkout' }) })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div>
        <PriceChangeAlert cart={cart} />
        {/* Desktop: tabela */}
        <table className="hidden w-full border-separate border-spacing-y-2 font-mono text-xs md:table">
          <caption className="sr-only">Itens do carrinho</caption>
          <thead>
            <tr className="text-left text-[11px]">
              <th scope="col" className="pb-1 font-bold">NFTs</th>
              <th scope="col" className="pb-1 font-bold">Preço</th>
              <th scope="col" className="pb-1 font-bold">Edições</th>
              <th scope="col" className="pb-1 font-bold">Total</th>
              <th scope="col" className="pb-1"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {cart.lines.map((l) => (
              <CartRow key={l.id} line={l} />
            ))}
          </tbody>
        </table>
        {/* Mobile: cards */}
        <ul className="space-y-4 md:hidden" aria-label="Itens do carrinho">
          {cart.lines.map((l) => (
            <CartCard key={l.id} line={l} />
          ))}
        </ul>
      </div>

      <aside aria-labelledby="summary-title" className="h-fit rounded-3xl bg-surface p-5 md:rounded-none md:bg-transparent md:p-0">
        <h2 id="summary-title" className="mb-4 hidden border-b border-border pb-2 font-mono text-xs font-bold md:block">
          Resumo da carteira
        </h2>
        <div className="mb-4 hidden md:block">
          <CouponForm cart={cart} />
        </div>
        <div className="mb-4 md:hidden">
          <CouponForm cart={cart} variant="mobile" />
        </div>
        <Totals cart={cart} />
        <Button
          className="mt-5 w-full md:h-8 md:rounded-sm md:text-[11px]"
          variant="default"
          size="pill"
          onClick={finalize}
          disabled={cart.hasPriceChanges}
          aria-describedby={cart.hasPriceChanges ? 'price-blocked' : undefined}
        >
          Conectar e finalizar
        </Button>
        {cart.hasPriceChanges && (
          <p id="price-blocked" className="mt-2 text-center text-[11px] text-warning">
            Aceite os novos preços para continuar.
          </p>
        )}
        <Link to="/market" className="mt-3 block text-center font-mono text-[11px] text-primary hover:underline">
          Continuar explorando
        </Link>
      </aside>
    </div>
  )
}

function useLineActions(line: CartLine) {
  const update = useUpdateQuantity()
  const remove = useRemoveLine()
  const max = Math.max(1, Math.min(line.stock, line.maxPerOrder))
  return { update, remove, max }
}

function PriceCell({ line }: { line: CartLine }) {
  return line.priceChanged ? (
    <span className="flex flex-col">
      <span className="text-[10px] text-subtle line-through">
        <Eth value={line.unitPrice} />
      </span>
      <Eth value={line.currentPrice} className="text-warning" />
    </span>
  ) : (
    <Eth value={line.unitPrice} />
  )
}

function CartRow({ line }: { line: CartLine }) {
  const { update, remove, max } = useLineActions(line)
  return (
    <tr className="bg-surface" data-testid="cart-line">
      <td className="rounded-l-sm p-2">
        <div className="flex items-center gap-3">
          <img src={line.thumb} alt="" width={48} height={48} className="size-12 object-cover" />
          <div>
            <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="font-bold hover:text-primary">
              {line.name}
            </Link>
            <p className="text-[10px] text-primary">
              ID do token: #{line.tokenId} · {line.editionLabel}
            </p>
          </div>
        </div>
      </td>
      <td className="p-2 text-primary">
        <PriceCell line={line} />
      </td>
      <td className="p-2">
        <QuantityStepper size="sm" label={`Quantidade de ${line.name}`} value={line.quantity} max={max} onChange={(q) => update.mutate({ lineId: line.id, quantity: q })} />
      </td>
      <td className="p-2 font-bold text-primary" data-testid="line-total">
        <Eth value={lineTotal(line)} />
      </td>
      <td className="rounded-r-sm p-2 text-right">
        <button type="button" onClick={() => remove.mutate(line.id)} className="rounded p-1.5 text-muted hover:text-destructive" aria-label={`Remover ${line.name} do carrinho`}>
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
  )
}

function CartCard({ line }: { line: CartLine }) {
  const { update, remove, max } = useLineActions(line)
  return (
    <li className="flex overflow-hidden rounded-2xl bg-surface-2 font-mono" data-testid="cart-line-mobile">
      <img src={line.thumb} alt="" width={120} height={120} className="size-28 shrink-0 object-cover" />
      <div className="flex flex-1 items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{line.name}</p>
          <p className="text-xs text-muted">Edição: {line.editionLabel}</p>
          <p className={cn('mt-2 text-base font-bold text-primary', line.priceChanged && 'text-warning')}>
            <Eth value={lineTotal(line)} />
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <QuantityStepper size="sm" label={`Quantidade de ${line.name}`} value={line.quantity} max={max} onChange={(q) => update.mutate({ lineId: line.id, quantity: q })} />
          <button type="button" onClick={() => remove.mutate(line.id)} className="p-1 text-muted hover:text-destructive" aria-label={`Remover ${line.name} do carrinho`}>
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </li>
  )
}

function EmptyCart() {
  return (
    <div className="rounded-3xl bg-surface p-10 text-center font-mono">
      <p className="text-sm font-bold">Seu carrinho está vazio</p>
      <p className="mt-2 text-xs text-muted">Explore o mercado e encontre sua próxima peça.</p>
      <Button asChild className="mt-6">
        <Link to="/market">Explorar NFTs</Link>
      </Button>
    </div>
  )
}

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]" aria-busy="true" aria-label="Carregando carrinho">
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

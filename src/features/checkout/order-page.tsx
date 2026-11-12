import { Link, useParams } from '@tanstack/react-router'
import { CheckCircle2, Loader2, MailOpen, XCircle } from 'lucide-react'
import type { Order } from '@/lib/api-types'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Eth } from '@/components/ui/eth'
import { Skeleton } from '@/components/ui/skeleton'
import { lineTotal } from '@/lib/cart-math'
import { formatDate, shortAddress } from '@/lib/utils'
import { useRealtime } from '@/features/realtime/realtime'
import { useOrder } from './api'

const PROVIDER_LABEL = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase' } as const
const NETWORK_LABEL = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' } as const

/**
 * Confirmação de pedido (`/orders/$orderId`). Acesso direto e refresh funcionam:
 * o estado vem do REST e é atualizado por `order.updated` (Socket.IO).
 * O recibo só é exibido para pedido CONFIRMADO; os valores são o snapshot do pedido.
 */
export function OrderPage() {
  const { orderId } = useParams({ from: '/private/orders/$orderId' })
  const { data: order, isPending, error, refetch } = useOrder(orderId)
  const { status: realtime } = useRealtime()

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-4 sm:px-6 md:pt-6">
      <div className="hidden md:block">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Atividade', to: '/profile/activity' }, { label: `Pedido ${orderId}` }]} />
      </div>
      {isPending ? (
        <div aria-busy="true" aria-label="Carregando pedido" className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : error ? (
        <section className="rounded-3xl bg-surface p-10 text-center font-mono" aria-labelledby="order-error">
          <h1 id="order-error" className="text-sm font-bold">
            {error.status === 404 || error.status === 403 ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}
          </h1>
          <p className="mt-2 text-xs text-muted">{error.message}</p>
          <div className="mt-6 flex justify-center gap-3">
            {error.isRetryable && (
              <Button size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link to="/profile/activity">Ver minhas compras</Link>
            </Button>
          </div>
        </section>
      ) : (
        <OrderStatusView order={order} reconnecting={realtime === 'reconnecting'} />
      )}
    </div>
  )
}

function OrderStatusView({ order, reconnecting }: { order: Order; reconnecting: boolean }) {
  return (
    <article className="overflow-hidden rounded-3xl bg-surface font-mono" aria-labelledby="order-title" data-testid="order-page" data-status={order.status}>
      <header className="flex flex-col items-center gap-2 border-b border-border px-6 pb-5 pt-8 text-center">
        {order.status === 'confirmed' ? (
          <MailOpen className="size-10 text-primary" aria-hidden strokeWidth={1.25} />
        ) : order.status === 'failed' ? (
          <XCircle className="size-10 text-destructive" aria-hidden strokeWidth={1.25} />
        ) : (
          <Loader2 className="size-10 animate-spin text-primary motion-reduce:animate-none" aria-hidden strokeWidth={1.25} />
        )}
        <h1 id="order-title" className="text-sm font-bold text-primary">
          {order.status === 'confirmed'
            ? 'Seus NFTs agora estão na sua carteira'
            : order.status === 'failed'
              ? 'Pagamento recusado'
              : 'Aguardando confirmação na rede'}
        </h1>
        <p role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted" data-testid="order-status" data-status={order.status}>
          {order.status === 'confirmed' ? (
            <>
              <CheckCircle2 className="size-3.5 text-success" aria-hidden /> Transação confirmada
            </>
          ) : order.status === 'failed' ? (
            <>{order.failureReason ?? 'A transação não foi concluída.'}</>
          ) : (
            <>Pedido {order.id} enviado. Você pode recarregar a página: o status será recuperado.</>
          )}
        </p>
      </header>

      {order.status === 'pending' && reconnecting && (
        <div className="px-6 pt-4">
          <Alert variant="info" title="Reconectando ao tempo real">
            Assim que a conexão voltar, o status do pedido será sincronizado. Nenhuma nova compra será criada.
          </Alert>
        </div>
      )}

      {order.status === 'failed' && (
        <div className="space-y-4 px-6 py-6 text-center text-xs">
          <p className="text-muted">Nenhum valor foi debitado e os itens continuam no seu carrinho.</p>
          <div className="flex justify-center gap-3">
            <Button asChild size="sm">
              <Link to="/cart">Voltar ao carrinho</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/profile/activity">Ver minhas compras</Link>
            </Button>
          </div>
        </div>
      )}

      {order.status === 'confirmed' && <Receipt order={order} />}

      {order.status === 'pending' && (
        <div className="px-6 py-6 text-xs">
          <h2 className="mb-2 font-bold">Itens do pedido</h2>
          <ul className="space-y-1 text-muted">
            {order.lines.map((l) => (
              <li key={`${l.nftId}-${l.editionId}`}>
                {l.name} · {l.editionLabel} (x {l.quantity})
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between font-bold">
            <span>Total</span>
            <Eth value={order.total} className="text-primary" />
          </p>
        </div>
      )}
    </article>
  )
}

function Receipt({ order }: { order: Order }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-px border-b border-border bg-border text-[10px] sm:grid-cols-4">
        {[
          ['ID da transação', <span key="tx" data-testid="order-tx">{shortAddress(order.txHash)}</span>],
          ['Data', formatDate(order.createdAt)],
          ['Total', <Eth key="t" value={order.total} />],
          ['Carteira', PROVIDER_LABEL[order.provider]],
        ].map(([k, v]) => (
          <div key={String(k)} className="bg-surface px-4 py-2">
            <dt className="text-muted">{k}</dt>
            <dd className="mt-0.5 text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="px-6 py-5 text-xs">
        <h2 className="mb-2 font-bold">Detalhes da transação</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem]">
            <thead>
              <tr className="text-left text-[10px]">
                <th scope="col" className="pb-2">
                  NFTs
                </th>
                <th scope="col" className="pb-2 text-center">
                  Edições
                </th>
                <th scope="col" className="pb-2 text-right">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={`${l.nftId}-${l.editionId}`} data-testid="receipt-line">
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <img src={l.thumb} alt="" width={32} height={32} className="size-8 object-cover" />
                      <span>
                        <span className="block font-bold">{l.name}</span>
                        <span className="block text-[10px] text-muted">ID do token: #{l.tokenId}</span>
                      </span>
                    </div>
                  </td>
                  <td className="text-center text-[10px] text-muted">
                    {l.editionLabel} (x {l.quantity})
                  </td>
                  <td className="text-right font-bold text-primary">
                    <Eth value={lineTotal(l)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto mt-3 w-full max-w-56 space-y-1 border-t border-border pt-2">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>
              <Eth value={order.subtotal} />
            </dd>
          </div>
          {order.coupon && (
            <div className="flex justify-between">
              <dt>Desconto ({order.coupon.code})</dt>
              <dd>
                − <Eth value={order.discount} />
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Taxa de rede</dt>
            <dd>
              <Eth value={order.networkFee} minDecimals={3} />
            </dd>
          </div>
          <div className="flex justify-between font-bold">
            <dt>Total</dt>
            <dd className="text-primary" data-testid="order-total">
              <Eth value={order.total} />
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-center text-[10px] leading-relaxed text-muted">
          Transação confirmada na rede {NETWORK_LABEL[order.wallet.network]}. A propriedade foi transferida para sua carteira {order.wallet.nickname} (
          {shortAddress(order.wallet.address)}).
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <SimulatedExplorer order={order} />
          <Button asChild size="sm" variant="outline">
            <Link to="/profile/activity">Ver minhas compras</Link>
          </Button>
        </div>
      </div>
    </>
  )
}

/** Explorador de blocos SIMULADO: o hash é fictício, então não abrimos um site real. */
function SimulatedExplorer({ order }: { order: Order }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Ver no explorador (simulado)</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md font-mono">
        <DialogTitle>Explorador de transações</DialogTitle>
        <DialogDescription className="mb-4">
          Ambiente de demonstração: esta transação existe apenas no backend simulado.
        </DialogDescription>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-muted">Hash</dt>
            <dd className="break-all">{order.txHash}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Status</dt>
            <dd>
              <Badge variant="success">Sucesso</Badge>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Rede</dt>
            <dd>{NETWORK_LABEL[order.wallet.network]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Para</dt>
            <dd>{shortAddress(order.wallet.address)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Valor</dt>
            <dd>
              <Eth value={order.total} />
            </dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  )
}

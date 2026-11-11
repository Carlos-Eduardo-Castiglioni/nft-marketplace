import { CheckCircle2, Loader2, MailOpen } from 'lucide-react'
import type { Order } from '@/lib/api-types'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Eth } from '@/components/ui/eth'
import { lineTotal } from '@/lib/cart-math'
import { formatDate, shortAddress } from '@/lib/utils'
import { useOrder } from './api'

const PROVIDER_LABEL = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase' } as const

/** Modal de confirmação ("Thank you") do Figma, com status em tempo real. */
export function OrderSuccessDialog({ order: initial, onClose }: { order: Order | null; onClose: () => void }) {
  // o status muda de "pending" para "confirmed" via evento `order.updated`
  const { data } = useOrder(initial?.id)
  const order = data ?? initial
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      {order && (
        <DialogContent className="max-w-lg p-0 sm:p-0">
          <div className="flex flex-col items-center gap-2 border-b border-border px-6 pb-4 pt-6 text-center">
            <MailOpen className="size-10 text-primary" aria-hidden strokeWidth={1.25} />
            <DialogTitle className="text-sm text-primary">Seus NFTs agora estão na sua carteira</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5" data-testid="order-status" data-status={order.status}>
              {order.status === 'confirmed' ? (
                <>
                  <CheckCircle2 className="size-3.5 text-success" aria-hidden /> Transação confirmada
                </>
              ) : (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Aguardando confirmação na rede…
                </>
              )}
            </DialogDescription>
          </div>
          <dl className="grid grid-cols-2 gap-px border-b border-border bg-border font-mono text-[10px] sm:grid-cols-4">
            {[
              ['ID da transação', shortAddress(order.txHash)],
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
          <div className="px-6 py-4 font-mono text-xs">
            <h3 className="mb-2 font-bold">Detalhes da transação</h3>
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px]">
                  <th scope="col" className="pb-2">NFTs</th>
                  <th scope="col" className="pb-2 text-center">Edições</th>
                  <th scope="col" className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l) => (
                  <tr key={`${l.nftId}-${l.editionLabel}`}>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2">
                        <img src={l.thumb} alt="" width={32} height={32} className="size-8 object-cover" />
                        <span>
                          <span className="block font-bold">{l.name}</span>
                          <span className="block text-[10px] text-muted">ID do token: #{l.tokenId}</span>
                        </span>
                      </div>
                    </td>
                    <td className="text-center text-[10px] text-muted">(x {l.quantity})</td>
                    <td className="text-right font-bold text-primary">
                      <Eth value={lineTotal(l)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="ml-auto mt-3 w-56 space-y-1 border-t border-border pt-2">
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
              Transação {order.status === 'confirmed' ? 'confirmada' : 'enviada'} na Ethereum. A propriedade foi transferida para sua carteira {order.wallet.nickname} ({shortAddress(order.wallet.address)}) e registrada na rede.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Button size="sm" onClick={() => window.open(`https://etherscan.io/tx/${order.txHash}`, '_blank', 'noopener')}>
                Ver no Etherscan
              </Button>
              <Button size="sm" variant="outline" onClick={onClose}>
                Ver minhas compras
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { Cart } from '@/lib/api-types'
import { add, isEthString } from '@/lib/eth'
import { qk } from '@/lib/query-keys'
import { mockLab } from './lab'
import { PAYMENT_OUTCOMES, ROUTE_KEYS, SCENARIO_KINDS, type PaymentOutcome, type RouteKey, type ScenarioKind } from './scenarios'

const selectClass = 'h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-xs'

/**
 * Painel para demonstrar a resiliência do app sem backend: injeta falhas,
 * dispara eventos do Socket.IO e derruba a conexão em tempo real.
 */
export function MockLabPanel() {
  const qc = useQueryClient()
  const cart = qc.getQueryData<Cart>(qk.cart)
  const [route, setRoute] = useState<RouteKey>('orders.create')
  const [kind, setKind] = useState<ScenarioKind>('timeout-after-commit')
  const [times, setTimes] = useState('1')
  const [nftId, setNftId] = useState(cart?.lines[0]?.nftId ?? 'emerald-ape-042')
  const [price, setPrice] = useState('')
  const [payment, setPayment] = useState<PaymentOutcome>(mockLab.config.payment)

  return (
    <Dialog>
      <DialogTrigger
        className="fixed bottom-20 left-3 z-40 flex items-center gap-1.5 rounded-full border border-border bg-surface-2/90 px-3 py-2 font-mono text-[10px] text-muted shadow-lg backdrop-blur hover:text-primary md:bottom-4"
        aria-label="Abrir Mock Lab (simulador de backend)"
      >
        <FlaskConical className="size-3.5" aria-hidden /> Mock Lab
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogTitle>Mock Lab</DialogTitle>
        <DialogDescription className="mb-4">
          Backend simulado com MSW ({window.__kurioMockMode}). Injete falhas determinísticas e eventos em tempo real.
        </DialogDescription>

        <section className="space-y-3 rounded-xl bg-surface-2 p-4" aria-labelledby="lab-net">
          <h3 id="lab-net" className="font-mono text-xs font-bold text-primary">
            Cenário de rede
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="lab-route">Rota</Label>
              <select id="lab-route" className={selectClass} value={route} onChange={(e) => setRoute(e.target.value as RouteKey)}>
                {ROUTE_KEYS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lab-kind">Cenário</Label>
              <select id="lab-kind" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as ScenarioKind)}>
                {SCENARIO_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="w-24 space-y-1">
              <Label htmlFor="lab-times">Vezes</Label>
              <input id="lab-times" className={selectClass} value={times} onChange={(e) => setTimes(e.target.value)} inputMode="numeric" />
            </div>
            <Button
              size="sm"
              onClick={() => {
                mockLab.setScenario(route, kind, { times: Number(times) || undefined })
                toast.info(`${route} → ${kind}`)
              }}
            >
              Aplicar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => (mockLab.clearScenarios(), toast.info('Cenários limpos'))}>
              Limpar
            </Button>
          </div>
        </section>

        <section className="mt-4 space-y-3 rounded-xl bg-surface-2 p-4" aria-labelledby="lab-rt">
          <h3 id="lab-rt" className="font-mono text-xs font-bold text-primary">
            Tempo real (Socket.IO)
          </h3>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <div className="space-y-1">
              <Label htmlFor="lab-nft">NFT</Label>
              <select id="lab-nft" className={selectClass} value={nftId} onChange={(e) => setNftId(e.target.value)}>
                {mockLab.listNftIds().map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lab-price">Novo preço</Label>
              <input id="lab-price" className={selectClass} placeholder="ex. 1.25" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                const current = mockLab.getNft(nftId)?.basePrice ?? '1'
                const next = isEthString(price) ? price : add(current, '0.05')
                mockLab.changePrice(nftId, next)
                toast.info(`nft.updated → ${nftId}: ${next} ETH`)
              }}
            >
              Emitir nft.updated
            </Button>
            <Button size="sm" variant="outline" onClick={() => (mockLab.dropSockets(2000), toast.info('Conexão derrubada por 2s'))}>
              Derrubar socket
            </Button>
            <Button size="sm" variant="ghost" onClick={() => (mockLab.replayLastEvent(), toast.info('Último evento reenviado (mesmo eventId)'))}>
              Duplicar evento
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                mockLab.emitStaleNftEvent(nftId, '0.01')
                toast.info('Evento com versão antiga emitido')
              }}
            >
              Evento antigo
            </Button>
          </div>
        </section>

        <section className="mt-4 space-y-3 rounded-xl bg-surface-2 p-4" aria-labelledby="lab-pay">
          <h3 id="lab-pay" className="font-mono text-xs font-bold text-primary">
            Pagamento
          </h3>
          <div className="space-y-1">
            <Label htmlFor="lab-payment">Resultado dos próximos pedidos</Label>
            <select
              id="lab-payment"
              className={selectClass}
              value={payment}
              onChange={(e) => {
                const next = e.target.value as PaymentOutcome
                setPayment(next)
                mockLab.setPayment(next)
                try {
                  localStorage.setItem('kurio:mock-payment', next)
                } catch {
                  /* ignore */
                }
              }}
            >
              {PAYMENT_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o === 'confirm' ? 'Confirmar' : o === 'decline' ? 'Recusar' : 'Manual (fica pendente)'}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" variant="outline" onClick={() => (mockLab.expireSessions(), toast.info('Sessões expiradas no servidor'))}>
            Expirar sessão
          </Button>
        </section>

        <div className="mt-4 flex justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              mockLab.reset()
              window.location.reload()
            }}
          >
            Resetar dados
          </Button>
          <span className="self-center font-mono text-[10px] text-subtle">Pedidos no servidor: {mockLab.countOrders()}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

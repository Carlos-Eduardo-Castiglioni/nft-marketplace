import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Eth } from '@/components/ui/eth'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatDate, shortAddress } from '@/lib/utils'
import { useOrders } from '@/features/checkout/api'

export function ActivityPage() {
  const { data, isPending } = useOrders()
  return (
    <section aria-labelledby="activity-title">
      <h1 id="activity-title" className="mb-5 text-xs font-bold">
        Atividade
      </h1>
      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="rounded-xl bg-surface p-8 text-center text-xs text-muted">
          Nenhuma compra ainda.
          <Button asChild size="sm" className="ml-3">
            <Link to="/market">Explorar</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3" data-testid="orders-list">
          {data.map((o) => (
            <li key={o.id} className="rounded-xl bg-surface p-4 text-xs" data-testid="order-item">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  Pedido {o.id} <span className="font-normal text-muted">· {formatDate(o.createdAt)}</span>
                </p>
                <Badge variant={o.status === 'confirmed' ? 'success' : 'warning'}>{o.status === 'confirmed' ? 'Confirmado' : 'Pendente'}</Badge>
              </div>
              <p className="mt-1 text-muted">
                {o.lines.map((l) => `${l.name} (x${l.quantity})`).join(', ')}
              </p>
              <p className="mt-2 flex justify-between">
                <span className="text-subtle">tx {shortAddress(o.txHash, 8, 6)}</span>
                <Eth value={o.total} className="font-bold text-primary" />
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

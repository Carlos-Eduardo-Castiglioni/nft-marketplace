/**
 * Aplicação dos eventos Socket.IO no cache do TanStack Query (sem React).
 * Separado do provider para ser testável e reaproveitável.
 */
import type { QueryClient } from '@tanstack/react-query'
import { isTerminalOrder, type Cart, type NftDetail, type NftListResponse, type NftSummary, type NftUpdatedEvent, type Order, type OrderUpdatedEvent } from '@/lib/api-types'
import { qk } from '@/lib/query-keys'

/**
 * Guarda de idempotência/ordenação dos eventos:
 * - `eventId` já visto => duplicata, descartada (não reaplica efeitos/toasts);
 * - `version` menor ou igual à última conhecida do recurso => evento antigo, descartado.
 * A versão conhecida considera também o que veio do REST (cache), então um evento
 * atrasado nunca regride um dado mais novo obtido na reconciliação.
 */
export class EventGuard {
  private seen = new Set<string>()
  private versions = new Map<string, number>()

  accept(e: { eventId: string; id: string; version: number }, kind: string, cachedVersion = 0) {
    if (this.seen.has(e.eventId)) return false
    this.seen.add(e.eventId)
    if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value!)
    const key = `${kind}:${e.id}`
    const known = Math.max(this.versions.get(key) ?? 0, cachedVersion)
    if (e.version <= known) return false
    this.versions.set(key, e.version)
    return true
  }
}

function cachedNftVersion(qc: QueryClient, id: string) {
  let v = qc.getQueryData<NftDetail>(qk.nfts.detail(id))?.version ?? 0
  for (const [, data] of qc.getQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] })) {
    const item = data?.items.find((n) => n.id === id)
    if (item) v = Math.max(v, item.version)
  }
  return v
}

/**
 * Aplica `nft.updated` no cache:
 * - listas: patch direto do preço (sem refetch, UI instantânea);
 * - detalhe e relacionados: invalidados (o servidor recalcula as edições);
 * - carrinho: invalidado — o servidor marca as linhas com `priceChanged`.
 * Retorna `false` quando o evento é duplicado ou antigo.
 */
export function applyNftUpdated(qc: QueryClient, e: NftUpdatedEvent, guard: EventGuard) {
  if (!guard.accept(e, 'nft', cachedNftVersion(qc, e.id))) return false
  const patch = (n: NftSummary) =>
    n.id === e.id ? { ...n, version: e.version, ...(e.price ? { previousPrice: n.price, price: e.price } : {}) } : n
  qc.setQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] }, (old) => (old ? { ...old, items: old.items.map(patch) } : old))
  qc.setQueriesData<NftSummary[]>({ queryKey: ['nfts', 'related'] }, (old) => old?.map(patch))
  qc.invalidateQueries({ queryKey: qk.nfts.detail(e.id) })
  const cart = qc.getQueryData<Cart>(qk.cart)
  if (!cart || cart.lines.some((l) => l.nftId === e.id)) qc.invalidateQueries({ queryKey: qk.cart })
  return true
}

/**
 * Aplica `order.updated`. Eventos de outro usuário são descartados (defesa em
 * profundidade: o servidor já filtra por conexão). Estados terminais nunca regridem.
 */
export function applyOrderUpdated(qc: QueryClient, e: OrderUpdatedEvent, guard: EventGuard, userId: string | undefined) {
  if (!userId || e.userId !== userId) return false
  const cached = qc.getQueryData<Order>(qk.orders.detail(e.id))
  if (cached && isTerminalOrder(cached.status)) return false
  if (!guard.accept(e, 'order', cached?.version ?? 0)) return false
  const patch = (o: Order): Order =>
    o.id === e.id ? { ...o, status: e.status, version: e.version, failureReason: e.failureReason, settledAt: e.at } : o
  qc.setQueryData<Order>(qk.orders.detail(e.id), (old) => (old ? patch(old) : old))
  qc.setQueryData<Order[]>(qk.orders.all, (old) => old?.map(patch))
  // garante o snapshot completo do servidor (ex.: pedido aberto em outra aba)
  qc.invalidateQueries({ queryKey: qk.orders.detail(e.id) })
  if (e.status === 'confirmed') {
    // o servidor removeu do carrinho só os itens comprados e baixou o estoque
    qc.invalidateQueries({ queryKey: qk.cart })
    qc.invalidateQueries({ queryKey: qk.nfts.all })
  }
  return true
}

/** Após reconectar, eventos podem ter sido perdidos: reconcilia tudo com o REST. */
export function reconcileAfterReconnect(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.nfts.all })
  qc.invalidateQueries({ queryKey: qk.cart })
  qc.invalidateQueries({ queryKey: qk.orders.all })
}

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Cart, NftDetail, NftListResponse, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/lib/api-types'
import { qk } from '@/lib/query-keys'
import { formatEth } from '@/lib/eth'

import { SOCKET_URL } from '@/lib/config'
export { SOCKET_URL }

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

interface RealtimeContextValue {
  status: RealtimeStatus
  /** incrementa a cada `nft.updated` — útil para destacar mudanças na UI */
  lastNftEvent: NftUpdatedEvent | null
  reconnects: number
}

const RealtimeContext = createContext<RealtimeContextValue>({ status: 'offline', lastNftEvent: null, reconnects: 0 })

export const useRealtime = () => useContext(RealtimeContext)

/**
 * Aplica `nft.updated` no cache:
 * - listas: patch direto do preço (sem refetch, UI instantânea);
 * - detalhe e relacionados: invalidados (o servidor recalcula as edições);
 * - carrinho: invalidado — o servidor marca as linhas com `priceChanged`.
 */
export function applyNftUpdated(qc: QueryClient, e: NftUpdatedEvent) {
  if (e.price) {
    const patch = (n: NftSummary) => (n.id === e.id ? { ...n, previousPrice: n.price, price: e.price! } : n)
    qc.setQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] }, (old) =>
      old ? { ...old, items: old.items.map(patch) } : old,
    )
    qc.setQueriesData<NftSummary[]>({ queryKey: ['nfts', 'related'] }, (old) => old?.map(patch))
  }
  qc.invalidateQueries({ queryKey: qk.nfts.detail(e.id) })
  const cart = qc.getQueryData<Cart>(qk.cart)
  if (!cart || cart.lines.some((l) => l.nftId === e.id)) qc.invalidateQueries({ queryKey: qk.cart })
}

export function applyOrderUpdated(qc: QueryClient, e: OrderUpdatedEvent) {
  qc.setQueryData<Order>(qk.orders.detail(e.id), (old) => (old ? { ...old, status: e.status } : old))
  qc.setQueryData<Order[]>(qk.orders.all, (old) => old?.map((o) => (o.id === e.id ? { ...o, status: e.status } : o)))
}

/** Após reconectar, eventos podem ter sido perdidos: reconcilia tudo com o REST. */
export function reconcileAfterReconnect(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.nfts.all })
  qc.invalidateQueries({ queryKey: qk.cart })
  qc.invalidateQueries({ queryKey: qk.orders.all })
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const [lastNftEvent, setLastNftEvent] = useState<NftUpdatedEvent | null>(null)
  const [reconnects, setReconnects] = useState(0)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 3_000,
      randomizationFactor: 0,
    })
    socketRef.current = socket
    let hasConnected = false

    socket.on('connect', () => {
      setStatus('connected')
      if (hasConnected) {
        reconcileAfterReconnect(qc)
        setReconnects((n) => n + 1)
      }
      hasConnected = true
    })
    socket.on('disconnect', () => setStatus('reconnecting'))
    socket.io.on('reconnect_attempt', () => setStatus('reconnecting'))
    socket.io.on('reconnect_failed', () => setStatus('offline'))

    socket.on('nft.updated', (e: NftUpdatedEvent) => {
      applyNftUpdated(qc, e)
      setLastNftEvent(e)
      const cart = qc.getQueryData<Cart>(qk.cart)
      const inCart = cart?.lines.find((l) => l.nftId === e.id)
      const detail = qc.getQueryData<NftDetail>(qk.nfts.detail(e.id))
      if (inCart && e.price) {
        toast.warning(`Preço atualizado: ${inCart.name}`, {
          description: `Novo preço base ${formatEth(e.price)}. Revise o carrinho antes de finalizar.`,
          id: `price-${e.id}`,
        })
      } else if (detail && e.price) {
        toast.info(`${detail.name} agora custa ${formatEth(e.price)}`, { id: `price-${e.id}` })
      }
    })
    socket.on('order.updated', (e: OrderUpdatedEvent) => applyOrderUpdated(qc, e))

    const onOnline = () => socket.connected || socket.connect()
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
      socket.removeAllListeners()
      socket.io.removeAllListeners()
      socket.disconnect()
    }
  }, [qc])

  const value = useMemo(() => ({ status, lastNftEvent, reconnects }), [status, lastNftEvent, reconnects])
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Cart, NftDetail, NftUpdatedEvent, OrderUpdatedEvent } from '@/lib/api-types'
import { applyNftUpdated, applyOrderUpdated, EventGuard, reconcileAfterReconnect } from './events'
import { useSession } from '@/features/auth/api'
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

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const [lastNftEvent, setLastNftEvent] = useState<NftUpdatedEvent | null>(null)
  const [reconnects, setReconnects] = useState(0)
  const socketRef = useRef<Socket | null>(null)
  const { data: session } = useSession()
  const token = session?.token
  const userId = session?.user.id

  // Um socket por sessão: login, logout ou troca de usuário encerram a conexão
  // anterior (e seus listeners) e abrem outra autenticada com o novo token.
  useEffect(() => {
    const guard = new EventGuard()
    // contadores observáveis (Mock Lab/E2E): quantos eventos foram aplicados ou descartados
    const stats = { applied: 0, ignored: 0 }
    ;(window as unknown as { __kurioRealtime?: typeof stats }).__kurioRealtime = stats
    let disposed = false
    let socket: Socket | null = null
    let removeOnline = () => {}

    // Import sob demanda: o engine.io captura `globalThis.WebSocket` ao ser
    // avaliado, então precisa carregar DEPOIS que o MSW instalou o interceptador.
    void import('socket.io-client').then(({ io }) => {
      if (disposed) return
      const s = io(SOCKET_URL, {
        transports: ['websocket'],
        // o token vai no handshake; o servidor só entrega `order.updated` ao dono
        query: token ? { token } : {},
        reconnectionDelay: 500,
        reconnectionDelayMax: 3_000,
        randomizationFactor: 0,
        // falha rápido em handshakes travados para seguir tentando
        timeout: 2_500,
      })
      socket = s
      socketRef.current = s
      ;(window as unknown as { __kurioSocket?: Socket }).__kurioSocket = s
      let hasConnected = false

      s.on('connect', () => {
        setStatus('connected')
        if (hasConnected) {
          reconcileAfterReconnect(qc)
          setReconnects((n) => n + 1)
        }
        hasConnected = true
      })
      s.on('disconnect', () => setStatus('reconnecting'))
      s.io.on('reconnect_attempt', () => setStatus('reconnecting'))
      s.io.on('reconnect_failed', () => setStatus('offline'))

      s.on('nft.updated', (e: NftUpdatedEvent) => {
        if (!applyNftUpdated(qc, e, guard)) return void stats.ignored++
        stats.applied++
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
      s.on('order.updated', (e: OrderUpdatedEvent) => {
        if (!applyOrderUpdated(qc, e, guard, userId)) return void stats.ignored++
        stats.applied++
        if (e.status === 'confirmed') toast.success('Pagamento confirmado na rede.', { id: `order-${e.id}` })
        else if (e.status === 'failed') toast.error('Pagamento recusado.', { id: `order-${e.id}`, description: e.failureReason })
      })

      const onOnline = () => s.connected || s.connect()
      window.addEventListener('online', onOnline)
      removeOnline = () => window.removeEventListener('online', onOnline)
    })

    return () => {
      disposed = true
      removeOnline()
      socket?.removeAllListeners()
      socket?.io.removeAllListeners()
      socket?.disconnect()
      socketRef.current = null
    }
  }, [qc, token, userId])

  const value = useMemo(() => ({ status, lastNftEvent, reconnects }), [status, lastNftEvent, reconnects])
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

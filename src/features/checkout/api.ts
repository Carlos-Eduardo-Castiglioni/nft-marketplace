import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Order, WalletProvider } from '@/lib/api-types'
import { ApiError, http, toApiError } from '@/lib/http'
import { qk } from '@/lib/query-keys'
import { STALE } from '@/app/query-client'
import { idempotency, intentOf } from './idempotency'

/** Timeout curto no checkout: o usuário recebe feedback rápido e pode tentar de novo. */
export const ORDER_TIMEOUT = 4_000
export const ORDER_AUTO_RETRIES = 1

export const ordersQuery = queryOptions({
  queryKey: qk.orders.all,
  queryFn: async ({ signal }) => (await http.get<Order[]>('/orders', { signal })).data,
  staleTime: STALE.orders,
})

/** Enquanto pendente, além do `order.updated`, consulta o REST periodicamente (fallback). */
export const PENDING_POLL_MS = 5_000

export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: qk.orders.detail(id),
    queryFn: async ({ signal }) => (await http.get<Order>(`/orders/${id}`, { signal })).data,
    staleTime: STALE.orders,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? PENDING_POLL_MS : false),
  })

export const useOrders = () => useQuery(ordersQuery)
export const useOrder = (id: string | undefined) => useQuery({ ...orderQuery(id ?? ''), enabled: !!id })

export interface CreateOrderInput {
  cartVersion: number
  walletId: string
  provider: WalletProvider
  /** total da cotação revisada pelo usuário; o servidor recusa se mudou */
  total: string
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function postOrder(input: CreateOrderInput, key: string) {
  const { data } = await http.post<Order>('/orders', input, {
    headers: { 'Idempotency-Key': key },
    timeout: ORDER_TIMEOUT,
  })
  return data
}

/**
 * Cria o pedido com idempotência:
 * - a chave vem da intenção (carrinho+carteira+provedor) e é reaproveitada em
 *   todas as tentativas, inclusive manuais e após refresh;
 * - timeouts/falhas de rede são re-tentados automaticamente com a MESMA chave;
 * - se ainda assim falhar, o erro é exposto e o botão "Tentar novamente"
 *   reenvia com a mesma chave — o servidor devolve o pedido já criado.
 */
export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const key = idempotency.keyFor(intentOf(input))
      let attempt = 0
      for (;;) {
        try {
          return await postOrder(input, key)
        } catch (e) {
          const err = toApiError(e)
          if (err.isRetryable && attempt < ORDER_AUTO_RETRIES) {
            attempt += 1
            await wait(400 * attempt)
            continue
          }
          // erro definitivo (4xx): a intenção não vai mais funcionar, descarta a chave
          if (!err.isRetryable) idempotency.clear()
          throw err
        }
      }
    },
    onSuccess: (order) => {
      idempotency.clear()
      qc.setQueryData(qk.orders.detail(order.id), order)
      qc.invalidateQueries({ queryKey: qk.orders.all, exact: true })
    },
    onError: (e: ApiError) => {
      if (['PRICE_CHANGED', 'CART_VERSION_MISMATCH', 'OUT_OF_STOCK', 'QUOTE_CHANGED'].includes(e.code)) {
        qc.invalidateQueries({ queryKey: qk.cart })
      }
      if (e.code === 'ORDER_PENDING') qc.invalidateQueries({ queryKey: qk.orders.all })
    },
    meta: { silent: true },
  })
}

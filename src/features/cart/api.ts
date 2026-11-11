import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Cart, EditionId } from '@/lib/api-types'
import { COUPONS, computeTotals } from '@/lib/cart-math'
import { http } from '@/lib/http'
import { qk } from '@/lib/query-keys'
import { STALE } from '@/app/query-client'

export const cartQuery = queryOptions({
  queryKey: qk.cart,
  queryFn: async ({ signal }) => (await http.get<Cart>('/cart', { signal })).data,
  staleTime: STALE.cart,
})

export const useCart = () => useQuery(cartQuery)

function useCartMutation<V>(fn: (v: V) => Promise<Cart>, opts: { silent?: boolean } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => qc.setQueryData(qk.cart, cart),
    meta: { silent: opts.silent },
  })
}

export const useAddToCart = () =>
  useCartMutation(
    async (v: { nftId: string; editionId: EditionId; quantity: number }) => (await http.post<Cart>('/cart/items', v)).data,
  )

/**
 * Alterar quantidade é otimista: recalcula os totais localmente (aritmética
 * decimal em string) e reconcilia com a resposta do servidor.
 */
export function useUpdateQuantity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { lineId: string; quantity: number }) =>
      (await http.patch<Cart>(`/cart/items/${v.lineId}`, { quantity: v.quantity })).data,
    onMutate: async ({ lineId, quantity }) => {
      await qc.cancelQueries({ queryKey: qk.cart })
      const prev = qc.getQueryData<Cart>(qk.cart)
      if (prev) {
        const lines = prev.lines.map((l) => (l.id === lineId ? { ...l, quantity } : l))
        const coupon = prev.coupon ? COUPONS[prev.coupon.code] : undefined
        qc.setQueryData<Cart>(qk.cart, { ...prev, lines, ...computeTotals(lines, coupon) })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.cart, ctx.prev),
    onSuccess: (cart) => qc.setQueryData(qk.cart, cart),
  })
}

export const useRemoveLine = () =>
  useCartMutation(async (lineId: string) => (await http.delete<Cart>(`/cart/items/${lineId}`)).data)

export const useApplyCoupon = () =>
  useCartMutation(async (code: string) => (await http.post<Cart>('/cart/coupon', { code })).data, { silent: true })

export const useRemoveCoupon = () => useCartMutation(async () => (await http.delete<Cart>('/cart/coupon')).data)

export const useAcceptPrices = () => useCartMutation(async () => (await http.post<Cart>('/cart/accept-prices')).data)

export const cartCount = (cart?: Cart) => cart?.lines.reduce((acc, l) => acc + l.quantity, 0) ?? 0

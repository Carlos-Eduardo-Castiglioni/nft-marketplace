import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, toApiError } from '@/lib/http'

/**
 * Políticas de cache (resumo):
 *
 * | Query            | staleTime | gcTime | Observações                                  |
 * |------------------|-----------|--------|----------------------------------------------|
 * | session          | ∞         | ∞      | invalidada no login/logout e em 401          |
 * | nfts (listas)    | 30s       | 5min   | keepPreviousData p/ paginação sem "piscar"   |
 * | nft (detalhe)    | 60s       | 10min  | atualizado em tempo real via `nft.updated`   |
 * | cart             | 0         | 5min   | sempre revalida; fonte da verdade é o REST   |
 * | orders           | 10s       | 5min   | atualizado via `order.updated`               |
 * | profile/wallets  | 60s       | 10min  |                                              |
 *
 * Retry: até 2 tentativas com backoff exponencial apenas para falhas
 * transitórias (timeout, rede, 5xx). Erros 4xx nunca são repetidos.
 */
export const STALE = {
  list: 30_000,
  detail: 60_000,
  cart: 0,
  orders: 10_000,
  profile: 60_000,
} as const

export function shouldRetry(failureCount: number, error: unknown) {
  const e = toApiError(error)
  return e.isRetryable && failureCount < 2
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // erros de background (já havia dado em tela) viram toast
        if (query.state.data !== undefined) toast.error(toApiError(error).message)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.silent) return
        const e = error instanceof ApiError ? error : toApiError(error)
        if (!e.field) toast.error(e.message)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: STALE.list,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean }
    defaultError: ApiError
  }
}

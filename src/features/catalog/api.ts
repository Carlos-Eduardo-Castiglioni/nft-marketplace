import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NftDetail, NftListResponse, NftSummary } from '@/lib/api-types'
import { http } from '@/lib/http'
import { qk } from '@/lib/query-keys'
import { STALE } from '@/app/query-client'
import type { CatalogSearch } from './search'

export const PAGE_SIZE = 9

export const nftListQuery = (search: CatalogSearch, pageSize = PAGE_SIZE) =>
  queryOptions({
    queryKey: qk.nfts.list({ ...search, pageSize }),
    queryFn: async ({ signal }) =>
      (await http.get<NftListResponse>('/nfts', { params: { ...search, pageSize }, signal })).data,
    staleTime: STALE.list,
    placeholderData: keepPreviousData,
  })

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nfts.detail(id),
    queryFn: async ({ signal }) => (await http.get<NftDetail>(`/nfts/${encodeURIComponent(id)}`, { signal })).data,
    staleTime: STALE.detail,
    gcTime: 10 * 60_000,
  })

export const relatedQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nfts.related(id),
    queryFn: async ({ signal }) =>
      (await http.get<NftSummary[]>(`/nfts/${encodeURIComponent(id)}/related`, { signal })).data,
    staleTime: STALE.detail,
  })

export const favoritesQuery = queryOptions({
  queryKey: qk.favorites,
  queryFn: async ({ signal }) => (await http.get<NftSummary[]>('/favorites', { signal })).data,
  staleTime: STALE.list,
})

export const useNftList = (search: CatalogSearch, pageSize?: number) => useQuery(nftListQuery(search, pageSize))
export const useNft = (id: string) => useQuery(nftDetailQuery(id))
export const useRelated = (id: string) => useQuery(relatedQuery(id))
export const useFavorites = () => useQuery(favoritesQuery)

type Snapshot = [readonly unknown[], unknown][]

/**
 * Favoritar com atualização otimista: altera todas as caches onde o NFT
 * aparece imediatamente e faz rollback se o servidor falhar.
 */
export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, favorite }: { id: string; favorite: boolean }) =>
      (await http.put<{ id: string; favorite: boolean }>(`/nfts/${encodeURIComponent(id)}/favorite`, { favorite })).data,
    onMutate: async ({ id, favorite }) => {
      await qc.cancelQueries({ queryKey: qk.nfts.all })
      await qc.cancelQueries({ queryKey: qk.favorites })
      const snapshot: Snapshot = [
        ...qc.getQueriesData({ queryKey: qk.nfts.all }),
        ...qc.getQueriesData({ queryKey: qk.favorites }),
      ]
      const patch = <T extends NftSummary>(n: T): T => (n.id === id ? { ...n, favorite } : n)
      qc.setQueriesData<unknown>({ queryKey: qk.nfts.all }, (old: unknown) => {
        if (!old) return old
        if (Array.isArray(old)) return (old as NftSummary[]).map(patch)
        if (typeof old === 'object' && old && 'items' in old) {
          const l = old as NftListResponse
          return { ...l, items: l.items.map(patch) }
        }
        return patch(old as NftDetail)
      })
      qc.setQueryData<NftSummary[]>(qk.favorites, (old) => {
        if (!old) return old
        if (!favorite) return old.filter((n) => n.id !== id)
        return old
      })
      return { snapshot }
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.favorites })
    },
  })
}

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NetworkId, Session, User, Wallet, WalletProvider } from '@/lib/api-types'
import { http } from '@/lib/http'
import { qk } from '@/lib/query-keys'
import { STALE } from '@/app/query-client'

export const profileQuery = queryOptions({
  queryKey: qk.profile,
  queryFn: async ({ signal }) => (await http.get<User>('/profile', { signal })).data,
  staleTime: STALE.profile,
})

export const walletsQuery = queryOptions({
  queryKey: qk.wallets,
  queryFn: async ({ signal }) => (await http.get<Wallet[]>('/wallets', { signal })).data,
  staleTime: STALE.profile,
})

export const useProfile = () => useQuery(profileQuery)
export const useWallets = () => useQuery(walletsQuery)

export type ProfileUpdate = Partial<Omit<User, 'id' | 'avatarUrl'>> & {
  /** data URL da imagem; `null` remove o avatar */
  avatarUrl?: string | null
  currentPassword?: string
  newPassword?: string
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProfileUpdate) => (await http.put<User>('/profile', input)).data,
    onSuccess: (user) => {
      qc.setQueryData(qk.profile, user)
      qc.setQueryData<Session | null>(qk.session, (s) => (s ? { ...s, user } : s))
    },
    meta: { silent: true },
  })
}

export interface WalletInput {
  role: Wallet['role']
  nickname: string
  address: string
  ensName?: string
  network: NetworkId
  provider: WalletProvider
}

export function useCreateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: WalletInput) => (await http.post<Wallet>('/wallets', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.wallets }),
  })
}

export function usePromoteWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await http.post<Wallet[]>(`/wallets/${id}/promote`)).data,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.wallets })
      const prev = qc.getQueryData<Wallet[]>(qk.wallets)
      qc.setQueryData<Wallet[]>(qk.wallets, (old) =>
        old?.map((w) => ({ ...w, role: w.id === id ? 'principal' : 'reserva' })),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.wallets, ctx.prev),
    onSuccess: (list) => qc.setQueryData(qk.wallets, list),
  })
}

export function useDeleteWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await http.delete(`/wallets/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.wallets }),
  })
}

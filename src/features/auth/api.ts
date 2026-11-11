import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@/lib/api-types'
import { ApiError, credentials, http } from '@/lib/http'
import { qk } from '@/lib/query-keys'

export const sessionQuery = queryOptions({
  queryKey: qk.session,
  queryFn: async (): Promise<Session | null> => {
    if (!credentials.getToken()) return null
    try {
      const { data } = await http.get<Session>('/auth/session')
      return data
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        credentials.setToken(null)
        return null
      }
      throw e
    }
  },
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
})

export const useSession = () => useQuery(sessionQuery)

export interface LoginInput {
  email: string
  password: string
}
export interface RegisterInput {
  username: string
  email: string
  password: string
}

function useOnSession() {
  const qc = useQueryClient()
  return (session: Session) => {
    credentials.setToken(session.token)
    qc.setQueryData(qk.session, session)
    // dados pessoais dependem do usuário
    qc.invalidateQueries({ queryKey: qk.favorites })
    qc.invalidateQueries({ queryKey: qk.nfts.all })
    qc.removeQueries({ queryKey: qk.orders.all })
    qc.removeQueries({ queryKey: qk.wallets })
    qc.removeQueries({ queryKey: qk.profile })
  }
}

export function useLogin() {
  const onSession = useOnSession()
  return useMutation({
    mutationFn: async (input: LoginInput) => (await http.post<Session>('/auth/login', input)).data,
    onSuccess: onSession,
    meta: { silent: true },
  })
}

export function useOAuthLogin() {
  const onSession = useOnSession()
  return useMutation({
    mutationFn: async (provider: 'google' | 'facebook') => (await http.post<Session>(`/auth/oauth/${provider}`)).data,
    onSuccess: onSession,
  })
}

export function useRegister() {
  const onSession = useOnSession()
  return useMutation({
    mutationFn: async (input: RegisterInput) => (await http.post<Session>('/auth/register', input)).data,
    onSuccess: onSession,
    meta: { silent: true },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await http.post('/auth/logout').catch(() => undefined)
    },
    onSettled: () => {
      credentials.setToken(null)
      qc.setQueryData(qk.session, null)
      qc.removeQueries({ queryKey: qk.orders.all })
      qc.removeQueries({ queryKey: qk.wallets })
      qc.removeQueries({ queryKey: qk.profile })
      qc.invalidateQueries({ queryKey: qk.favorites })
    },
  })
}

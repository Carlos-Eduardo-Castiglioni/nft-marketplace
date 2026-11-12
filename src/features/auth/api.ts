import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Session } from '@/lib/api-types'
import { ApiError, credentials, http } from '@/lib/http'
import { qk } from '@/lib/query-keys'
import { idempotency } from '@/features/checkout/idempotency'

/**
 * Remove do cache tudo que pertence a um usuário. Usado no login (troca de
 * usuário), logout e expiração: nenhum dado privado sobrevive à sessão anterior.
 * O socket da sessão anterior é encerrado pelo RealtimeProvider (depende do token).
 */
export function clearPrivateData(qc: QueryClient) {
  qc.removeQueries({ queryKey: qk.orders.all })
  qc.removeQueries({ queryKey: qk.wallets })
  qc.removeQueries({ queryKey: qk.profile })
  qc.removeQueries({ queryKey: qk.favorites })
  qc.removeQueries({ queryKey: qk.cart })
  // listas/detalhes carregam o flag `favorite` do usuário
  qc.invalidateQueries({ queryKey: qk.nfts.all })
}

/** Sessão expirou no servidor: mantém o carrinho do usuário no servidor para a retomada. */
export function expireSession(qc: QueryClient) {
  credentials.setToken(null)
  qc.setQueryData(qk.session, null)
  clearPrivateData(qc)
}

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
    const previous = qc.getQueryData<Session | null>(qk.session)
    credentials.setToken(session.token)
    if (previous && previous.user.id !== session.user.id) idempotency.clear()
    // dados pessoais dependem do usuário; o carrinho do visitante foi mesclado no servidor
    clearPrivateData(qc)
    qc.setQueryData(qk.session, session)
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
      // o carrinho ficou com o usuário; o próximo visitante começa um carrinho vazio
      credentials.rotateCartId()
      idempotency.clear()
      qc.setQueryData(qk.session, null)
      clearPrivateData(qc)
    },
  })
}

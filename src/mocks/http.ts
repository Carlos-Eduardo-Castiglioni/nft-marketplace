import { delay, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody } from '@/lib/api-types'
import { db, type UserRecord } from './db'
import { consumeScenario, nextLatency, type RouteKey } from './scenarios'

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return HttpResponse.json<ApiErrorBody>({ code, message, details }, { status })
}

export function getUser(request: Request): UserRecord | null {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const userId = db.state.sessions[token]
  return userId ? (db.state.users[userId] ?? null) : null
}

export function getCartId(request: Request): string | null {
  return request.headers.get('x-cart-id')
}

/** Dono do estado "pessoal" (favoritos): usuário logado ou carrinho anônimo. */
export function getOwnerId(request: Request): string | null {
  return getUser(request)?.id ?? getCartId(request)
}

type Resolver<Params extends PathParams, Body extends DefaultBodyType> = HttpResponseResolver<Params, Body>

/**
 * Envolve um resolver aplicando latência e o cenário de falha configurado.
 * `timeout-after-commit` executa o resolver (efetiva a escrita) e depois
 * "trava" a resposta — reproduz o caso clássico em que o servidor processou o
 * pedido mas o cliente nunca recebeu a confirmação.
 */
export function withScenario<Params extends PathParams = PathParams, Body extends DefaultBodyType = DefaultBodyType>(
  route: RouteKey,
  resolver: Resolver<Params, Body>,
): Resolver<Params, Body> {
  return async (info) => {
    const scenario = consumeScenario(route)
    await delay(nextLatency(scenario))
    switch (scenario) {
      case 'server-error':
        return apiError(500, 'INTERNAL', 'Erro interno simulado. Tente novamente.')
      case 'bad-request':
        return apiError(400, 'BAD_REQUEST', 'Requisição inválida (simulada).')
      case 'not-found':
        return apiError(404, 'NOT_FOUND', 'Recurso não encontrado (simulado).')
      case 'unauthorized':
        return apiError(401, 'UNAUTHORIZED', 'Sessão expirada (simulado).')
      case 'conflict':
        return apiError(409, 'CONFLICT', 'Conflito de versão (simulado).')
      case 'network-error':
        return HttpResponse.error()
      case 'timeout':
        await delay('infinite')
        return HttpResponse.error()
      case 'timeout-after-commit': {
        await resolver(info)
        await delay('infinite')
        return HttpResponse.error()
      }
      default:
        return resolver(info)
    }
  }
}

export function requireUser(request: Request) {
  const user = getUser(request)
  if (!user) throw apiError(401, 'UNAUTHORIZED', 'Faça login para continuar.')
  return user
}

export function publicUser(u: UserRecord) {
  const { password: _password, ...rest } = u
  return rest
}

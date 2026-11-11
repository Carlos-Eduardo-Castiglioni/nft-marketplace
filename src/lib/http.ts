import axios, { AxiosError } from 'axios'
import type { ApiErrorBody } from './api-types'
import { safeStorage, uuid } from './utils'

const TOKEN_KEY = 'kurio:token'
// fallback em memória para ambientes sem storage (aba privada, iframe sandbox)
const memory: Record<string, string | null> = {}
const CART_KEY = 'kurio:cart-id'

export const credentials = {
  getToken: () => safeStorage()?.getItem(TOKEN_KEY) ?? memory[TOKEN_KEY] ?? null,
  setToken: (t: string | null) => {
    memory[TOKEN_KEY] = t
    const s = safeStorage()
    if (!s) return
    if (t) s.setItem(TOKEN_KEY, t)
    else s.removeItem(TOKEN_KEY)
  },
  getCartId: () => {
    const s = safeStorage()
    let id = s?.getItem(CART_KEY) ?? memory[CART_KEY]
    if (!id) {
      id = `cart-${uuid()}`
      memory[CART_KEY] = id
      s?.setItem(CART_KEY, id)
    }
    return id
  },
}

export const DEFAULT_TIMEOUT = 8_000

export const http = axios.create({
  baseURL: new URL('api', document.baseURI).toString(),
  timeout: DEFAULT_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = credentials.getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Cart-Id', credentials.getCartId())
  return config
})

export type ApiErrorKind = 'http' | 'timeout' | 'network' | 'canceled' | 'unknown'

/** Erro normalizado da camada HTTP — toda a UI trabalha com ele. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code: string
  readonly details?: unknown

  constructor(opts: { kind: ApiErrorKind; message: string; status?: number; code?: string; details?: unknown }) {
    super(opts.message)
    this.name = 'ApiError'
    this.kind = opts.kind
    this.status = opts.status
    this.code = opts.code ?? opts.kind.toUpperCase()
    this.details = opts.details
  }

  get isClientError() {
    return this.status !== undefined && this.status >= 400 && this.status < 500
  }

  /** Falhas transitórias que valem nova tentativa automática. */
  get isRetryable() {
    return this.kind === 'timeout' || this.kind === 'network' || (this.status !== undefined && this.status >= 500)
  }

  get field(): string | undefined {
    const d = this.details as { field?: string } | undefined
    return d?.field
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError({ kind: 'canceled', message: 'Requisição cancelada.' })
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError({ kind: 'timeout', message: 'O servidor demorou para responder.' })
    }
    if (error.response) {
      const body = error.response.data as Partial<ApiErrorBody> | undefined
      return new ApiError({
        kind: 'http',
        status: error.response.status,
        code: body?.code ?? `HTTP_${error.response.status}`,
        message: body?.message ?? 'Algo deu errado. Tente novamente.',
        details: body?.details,
      })
    }
    return new ApiError({ kind: 'network', message: 'Sem conexão com o servidor.' })
  }
  return new ApiError({ kind: 'unknown', message: error instanceof Error ? error.message : 'Erro desconhecido.' })
}

http.interceptors.response.use(
  (r) => r,
  (error) => Promise.reject(toApiError(error)),
)

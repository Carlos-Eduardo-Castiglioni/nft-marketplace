/**
 * Cenários determinísticos de rede. Cada rota da API simulada tem uma chave
 * (ex.: "nfts.list") e pode receber um cenário — opcionalmente por N chamadas.
 *
 *   window.__kurioMock.setScenario('orders.create', 'timeout-after-commit', { times: 1 })
 *
 * Também é possível ativar pela URL: ?mock=nfts.list:server-error
 */

export type ScenarioKind =
  | 'ok'
  | 'slow'
  | 'server-error'
  | 'bad-request'
  | 'not-found'
  | 'unauthorized'
  | 'conflict'
  | 'timeout'
  | 'timeout-after-commit'
  | 'network-error'

export const SCENARIO_KINDS: ScenarioKind[] = [
  'ok',
  'slow',
  'server-error',
  'bad-request',
  'not-found',
  'unauthorized',
  'conflict',
  'timeout',
  'timeout-after-commit',
  'network-error',
]

export type RouteKey =
  | 'auth.session'
  | 'auth.login'
  | 'auth.register'
  | 'nfts.list'
  | 'nfts.detail'
  | 'nfts.related'
  | 'nfts.favorite'
  | 'cart.get'
  | 'cart.mutate'
  | 'orders.create'
  | 'orders.list'
  | 'orders.get'
  | 'profile'
  | 'wallets'

export const ROUTE_KEYS: RouteKey[] = [
  'auth.session',
  'auth.login',
  'auth.register',
  'nfts.list',
  'nfts.detail',
  'nfts.related',
  'nfts.favorite',
  'cart.get',
  'cart.mutate',
  'orders.create',
  'orders.list',
  'orders.get',
  'profile',
  'wallets',
]

interface ActiveScenario {
  kind: ScenarioKind
  /** quantas requisições ainda serão afetadas (Infinity = até limpar) */
  remaining: number
}

const active = new Map<RouteKey, ActiveScenario>()

export type PaymentOutcome = 'confirm' | 'decline' | 'manual'
export const PAYMENT_OUTCOMES: PaymentOutcome[] = ['confirm', 'decline', 'manual']

export const mockConfig = {
  /** latência base de toda resposta (ms) — determinística, sem jitter */
  latency: 250,
  slowLatency: 2500,
  /**
   * Latência variável: cada resposta recebe `latency + jitter[i % n]` ms.
   * A sequência é fixa (reprodutível) e produz respostas fora de ordem.
   */
  jitter: [] as number[],
  /** resultado do pagamento na liquidação simulada */
  payment: 'confirm' as PaymentOutcome,
  /** tempo até a "rede" liquidar o pedido (ms) */
  settleDelay: 1200,
}

let jitterIndex = 0
/** Próxima latência da sequência determinística. */
export function nextLatency(kind: ScenarioKind) {
  if (kind === 'slow') return mockConfig.slowLatency
  const j = mockConfig.jitter
  return mockConfig.latency + (j.length ? j[jitterIndex++ % j.length] : 0)
}

export function setScenario(route: RouteKey, kind: ScenarioKind, opts: { times?: number } = {}) {
  if (kind === 'ok') active.delete(route)
  else active.set(route, { kind, remaining: opts.times ?? Infinity })
}

export function clearScenarios() {
  active.clear()
}

export function listScenarios() {
  return Object.fromEntries([...active.entries()].map(([k, v]) => [k, { ...v }]))
}

/** Consome (decrementa) o cenário ativo para a rota. */
export function consumeScenario(route: RouteKey): ScenarioKind {
  const s = active.get(route)
  if (!s) return 'ok'
  s.remaining -= 1
  if (s.remaining <= 0) active.delete(route)
  return s.kind
}

export function initScenariosFromEnvironment() {
  try {
    const latency = localStorage.getItem('kurio:mock-latency')
    if (latency !== null && !Number.isNaN(Number(latency))) mockConfig.latency = Number(latency)
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment') ?? localStorage.getItem('kurio:mock-payment')
    if (PAYMENT_OUTCOMES.includes(payment as PaymentOutcome)) mockConfig.payment = payment as PaymentOutcome
    const settle = localStorage.getItem('kurio:mock-settle-delay')
    if (settle !== null && !Number.isNaN(Number(settle))) mockConfig.settleDelay = Number(settle)
    const jitter = params.get('jitter') ?? localStorage.getItem('kurio:mock-jitter')
    if (jitter) mockConfig.jitter = jitter.split(',').map(Number).filter((n) => Number.isFinite(n) && n >= 0)
    for (const entry of params.getAll('mock')) {
      const [route, kind, times] = entry.split(':')
      if (ROUTE_KEYS.includes(route as RouteKey) && SCENARIO_KINDS.includes(kind as ScenarioKind)) {
        setScenario(route as RouteKey, kind as ScenarioKind, { times: times ? Number(times) : undefined })
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * "Banco de dados" do backend simulado. Vive no navegador e é persistido no
 * localStorage para que refresh/navegação mantenham carrinho, sessão e pedidos.
 * `resetDb()` restaura integralmente o cenário conhecido (seed).
 */
import type { EditionId, Order, User, Wallet } from '@/lib/api-types'
import type { EthString } from '@/lib/eth'
import { NFT_FIXTURES, type NftRecord } from './fixtures/nfts'
import { hashPassword, type PasswordHash } from './password'

export interface UserRecord extends User {
  /** nunca a senha em claro: sha256(salt:senha) */
  password: PasswordHash
}

export interface NftRow extends NftRecord {
  /** versão do recurso: cresce a cada mudança de preço/estoque (vai nos eventos) */
  version: number
}

export interface CartLineRecord {
  id: string
  nftId: string
  editionId: EditionId
  quantity: number
  unitPrice: EthString
}

export interface CartRecord {
  id: string
  version: number
  lines: CartLineRecord[]
  couponCode?: string
}

export interface OrderRecord extends Order {
  ownerId: string
  cartId: string
  /** momento em que a "rede" liquida o pedido (sobrevive a refresh da página) */
  settleAt?: number
  /** resultado que a simulação vai aplicar ao liquidar */
  outcome?: 'confirmed' | 'failed'
}

export interface DbState {
  schema: number
  nfts: Record<string, NftRow>
  users: Record<string, UserRecord>
  sessions: Record<string, string>
  carts: Record<string, CartRecord>
  favorites: Record<string, string[]>
  wallets: Record<string, Wallet[]>
  orders: Record<string, OrderRecord>
  idempotency: Record<string, { orderId: string; fingerprint: string }>
}

const STORAGE_KEY = 'kurio:mock-db'
const SCHEMA = 4

/** Credenciais fictícias documentadas no README. */
export const DEMO_CREDENTIALS = [
  { email: 'contato@email.com', password: 'Kurio@123' },
  { email: 'rafa@email.com', password: 'Kurio@456' },
] as const

export const DEMO_USER: UserRecord = {
  id: 'user-demo',
  username: 'colecionador',
  displayName: 'Nova Seto',
  email: DEMO_CREDENTIALS[0].email,
  password: hashPassword(DEMO_CREDENTIALS[0].password, 'seed-salt-demo'),
  ensName: 'nova',
  walletNickname: 'Reserva',
}

export const SECOND_USER: UserRecord = {
  id: 'user-rafa',
  username: 'rafa.lume',
  displayName: 'Rafa Lume',
  email: DEMO_CREDENTIALS[1].email,
  password: hashPassword(DEMO_CREDENTIALS[1].password, 'seed-salt-rafa'),
  ensName: 'rafalume',
  walletNickname: 'Principal',
}

function seed(): DbState {
  return {
    schema: SCHEMA,
    nfts: Object.fromEntries(NFT_FIXTURES.map((n) => [n.id, { ...structuredClone(n), version: 1 }])),
    users: { [DEMO_USER.id]: structuredClone(DEMO_USER), [SECOND_USER.id]: structuredClone(SECOND_USER) },
    sessions: {},
    carts: {},
    favorites: { [SECOND_USER.id]: ['golden-beat-207'] },
    wallets: {
      [DEMO_USER.id]: [
        { id: 'wallet-reserva', role: 'reserva', nickname: 'Reserva', address: 'nova.kurio.eth', ensName: 'nova.kurio.eth', network: 'polygon', provider: 'coinbase' },
        { id: 'wallet-principal', role: 'principal', nickname: 'Principal', address: '0xA91F3c7B5e2D4a8f9C1b6E0d3F7a2B4c8D9EE82C', network: 'ethereum', provider: 'metamask' },
      ],
      [SECOND_USER.id]: [
        { id: 'wallet-rafa', role: 'principal', nickname: 'Principal', address: '0x5Be0Cd19137e2179A54fF53A3C6Ef372BB67Ae85', network: 'ethereum', provider: 'walletconnect' },
      ],
    },
    orders: {},
    idempotency: {},
  }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === SCHEMA) return parsed
    }
  } catch {
    /* storage indisponível: segue em memória */
  }
  return seed()
}

export const db: { state: DbState } = { state: load() }

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db.state))
  } catch {
    /* ignore */
  }
}

const resetListeners = new Set<() => void>()
export const onReset = (fn: () => void) => resetListeners.add(fn)

export function resetDb() {
  db.state = seed()
  persist()
  for (const fn of resetListeners) fn()
}

/** Incrementa a versão do NFT (toda mudança de preço/estoque). */
export function bumpNft(id: string) {
  const n = db.state.nfts[id]
  n.version += 1
  return n.version
}

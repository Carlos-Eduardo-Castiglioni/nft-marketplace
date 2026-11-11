/**
 * "Banco de dados" do backend simulado. Vive no navegador e é persistido no
 * localStorage para que refresh/navegação mantenham carrinho, sessão e pedidos.
 */
import type { EditionId, Order, User, Wallet } from '@/lib/api-types'
import type { EthString } from '@/lib/eth'
import { NFT_FIXTURES, type NftRecord } from './fixtures/nfts'

export interface UserRecord extends User {
  password: string
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

export interface DbState {
  schema: number
  nfts: Record<string, NftRecord>
  users: Record<string, UserRecord>
  sessions: Record<string, string>
  carts: Record<string, CartRecord>
  favorites: Record<string, string[]>
  wallets: Record<string, Wallet[]>
  orders: Record<string, Order & { ownerId: string }>
  idempotency: Record<string, { orderId: string; fingerprint: string }>
}

const STORAGE_KEY = 'kurio:mock-db'
const SCHEMA = 3

export const DEMO_USER: UserRecord = {
  id: 'user-demo',
  username: 'colecionador',
  displayName: 'Nova Seto',
  email: 'contato@email.com',
  password: 'Kurio@123',
  ensName: 'nova',
  walletNickname: 'Reserva',
}

function seed(): DbState {
  return {
    schema: SCHEMA,
    nfts: Object.fromEntries(NFT_FIXTURES.map((n) => [n.id, structuredClone(n)])),
    users: { [DEMO_USER.id]: { ...DEMO_USER } },
    sessions: {},
    carts: {},
    favorites: {},
    wallets: {
      [DEMO_USER.id]: [
        { id: 'wallet-reserva', role: 'reserva', nickname: 'Reserva', address: 'nova.kurio.eth', ensName: 'nova.kurio.eth', network: 'polygon', provider: 'coinbase' },
        { id: 'wallet-principal', role: 'principal', nickname: 'Principal', address: '0xA91F3c7B5e2D4a8f9C1b6E0d3F7a2B4c8D9EE82C', network: 'ethereum', provider: 'metamask' },
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

export function resetDb() {
  db.state = seed()
  persist()
}

/** Contratos da API simulada (compartilhados entre app e MSW). */
import type { EthString } from './eth'

export type NetworkId = 'ethereum' | 'polygon' | 'solana'
export type SortId = 'recent' | 'price-asc' | 'price-desc' | 'name'
export type TabId = 'all' | 'new' | 'trending'
export type EditionId = '1/1' | '1/10' | '1/50' | 'open'
export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase'

export interface Edition {
  id: EditionId
  label: string
  price: EthString
  /** quantidade ainda disponível para compra */
  stock: number
  /** limite por pedido (carteira) */
  maxPerOrder: number
}

export interface NftSummary {
  id: string
  tokenId: string
  name: string
  image: string
  thumb: string
  price: EthString
  previousPrice?: EthString
  collection: string
  collectionLabel: string
  network: NetworkId
  rarity?: 'raro' | 'lendario'
  listedAt: string
  trendingScore: number
  isNew: boolean
  favorite: boolean
  /** versão do recurso no servidor; cresce a cada mudança de preço/estoque */
  version: number
}

export interface NftDetail extends NftSummary {
  series: string
  description: string
  longDescription: string[]
  editions: Edition[]
  attributes: string[]
  rating: number
  reviewsCount: number
  reviews: { id: string; author: string; rating: number; text: string }[]
  contract: string
  royalties: string
  gallery: string[]
}

export interface Facet {
  id: string
  label: string
  count: number
}

export interface NftListResponse {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: { collections: Facet[]; networks: Facet[]; priceRange: { min: EthString; max: EthString } }
}

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  ensName: string
  walletNickname: string
  avatarUrl?: string
}

export interface Session {
  token: string
  user: User
}

export interface Wallet {
  id: string
  role: 'principal' | 'reserva'
  nickname: string
  address: string
  ensName?: string
  network: NetworkId
  provider: WalletProvider
}

export interface CartLine {
  id: string
  nftId: string
  name: string
  tokenId: string
  thumb: string
  editionId: EditionId
  editionLabel: string
  quantity: number
  /** preço travado quando o item foi adicionado / aceito */
  unitPrice: EthString
  /** preço vigente no "servidor" */
  currentPrice: EthString
  stock: number
  maxPerOrder: number
  priceChanged: boolean
}

export interface Cart {
  id: string
  version: number
  lines: CartLine[]
  coupon?: { code: string; label: string }
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  hasPriceChanges: boolean
}

/** `confirmed` e `failed` são terminais: nunca voltam para `pending`. */
export type OrderStatus = 'pending' | 'confirmed' | 'failed'

export const isTerminalOrder = (status: OrderStatus) => status !== 'pending'

export type OrderLine = Pick<CartLine, 'nftId' | 'name' | 'tokenId' | 'thumb' | 'editionId' | 'editionLabel' | 'quantity' | 'unitPrice'>

/**
 * Pedido + recibo. Os valores são um SNAPSHOT do momento da criação:
 * mudanças posteriores no catálogo não alteram o recibo.
 */
export interface Order {
  id: string
  txHash: string
  status: OrderStatus
  /** cresce a cada transição de estado (pending=1, terminal=2) */
  version: number
  createdAt: string
  settledAt?: string
  /** motivo da recusa quando `status === 'failed'` */
  failureReason?: string
  lines: OrderLine[]
  coupon?: { code: string; label: string }
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  wallet: Pick<Wallet, 'nickname' | 'address' | 'network'>
  provider: WalletProvider
  idempotencyKey: string
}

export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
}

/**
 * Eventos do Socket.IO simulado. Todos carregam:
 * - `eventId`: identidade estável (duplicatas são descartadas pelo cliente);
 * - `id`: recurso afetado;
 * - `version`: versão do recurso após a mudança (eventos antigos são ignorados).
 */
export interface NftUpdatedEvent {
  eventId: string
  id: string
  version: number
  editionId?: EditionId
  /** novo preço base (edição 1/50, a mesma exibida no catálogo) */
  price?: EthString
  stock?: number
  at: string
}

export interface OrderUpdatedEvent {
  eventId: string
  id: string
  version: number
  /** dono do pedido — o cliente descarta eventos de outro usuário */
  userId: string
  status: OrderStatus
  failureReason?: string
  at: string
}

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

export type OrderStatus = 'pending' | 'confirmed' | 'failed'

export interface Order {
  id: string
  txHash: string
  status: OrderStatus
  createdAt: string
  lines: Pick<CartLine, 'nftId' | 'name' | 'tokenId' | 'thumb' | 'editionLabel' | 'quantity' | 'unitPrice'>[]
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

/** Eventos do Socket.IO simulado */
export interface NftUpdatedEvent {
  id: string
  editionId?: EditionId
  price?: EthString
  stock?: number
  at: string
}

export interface OrderUpdatedEvent {
  id: string
  status: OrderStatus
  at: string
}

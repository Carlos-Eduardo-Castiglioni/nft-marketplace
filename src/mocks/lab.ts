/**
 * API de controle do backend simulado, exposta em `window.__kurioMock`.
 * Usada pelos testes E2E (Playwright) e pelo painel "Mock Lab" do app.
 * Toda mudança de dado passa pelo "banco" do MSW e é refletida tanto nas
 * respostas REST quanto nos eventos Socket.IO correspondentes.
 */
import { eq, type EthString } from '@/lib/eth'
import type { EditionId } from '@/lib/api-types'
import { bumpNft, db, persist, resetDb } from './db'
import { settleOrder } from './orders'
import {
  connectionCount,
  dropConnections,
  emitNftUpdated,
  emitStaleNftEvent,
  pauseConnections,
  replayLastEvent,
  resumeConnections,
} from './realtime'
import { clearScenarios, listScenarios, mockConfig, setScenario, type PaymentOutcome } from './scenarios'

export const mockLab = {
  setScenario,
  clearScenarios,
  listScenarios,
  config: mockConfig,
  reset: resetDb,
  connectionCount,

  /** Altera o preço base de um NFT. `silent` não emite evento (simula perda durante desconexão). */
  changePrice(nftId: string, price: EthString, opts: { silent?: boolean } = {}) {
    const n = db.state.nfts[nftId]
    if (!n) throw new Error(`NFT ${nftId} não existe`)
    if (eq(n.basePrice, price)) return
    n.previousPrice = n.basePrice
    n.basePrice = price
    const version = bumpNft(nftId)
    persist()
    if (!opts.silent) emitNftUpdated({ id: nftId, version, price })
  },

  changeStock(nftId: string, editionId: EditionId, stock: number, opts: { silent?: boolean } = {}) {
    const n = db.state.nfts[nftId]
    if (!n) throw new Error(`NFT ${nftId} não existe`)
    n.stock[editionId] = stock
    const version = bumpNft(nftId)
    persist()
    if (!opts.silent) emitNftUpdated({ id: nftId, version, editionId, stock })
  },

  /** Reenvia o último evento com o mesmo `eventId` (duplicata). */
  replayLastEvent,
  /** Emite um `nft.updated` com versão anterior à atual (evento atrasado). */
  emitStaleNftEvent,

  dropSockets: dropConnections,
  pauseSockets: pauseConnections,
  resumeSockets: resumeConnections,

  /** Resultado do pagamento dos próximos pedidos: confirmar, recusar ou aguardar `settleOrder`. */
  setPayment(outcome: PaymentOutcome) {
    mockConfig.payment = outcome
  },
  /** Liquida um pedido pendente (modo `manual`). */
  settleOrder: (id: string, outcome: 'confirmed' | 'failed' = 'confirmed') => settleOrder(id, outcome),

  getNft: (id: string) => structuredClone(db.state.nfts[id]),
  listNftIds: () => Object.keys(db.state.nfts),
  countOrders: () => Object.keys(db.state.orders).length,
  listOrders: () => Object.values(db.state.orders).map(({ id, status, ownerId }) => ({ id, status, ownerId })),
  /** Encerra a sessão no servidor (simula expiração do token). */
  expireSessions() {
    db.state.sessions = {}
    persist()
  },
}

export type MockLab = typeof mockLab

declare global {
  interface Window {
    __kurioMock?: MockLab
    __kurioMockMode?: 'service-worker' | 'inline'
  }
}

/**
 * API de controle do backend simulado, exposta em `window.__kurioMock`.
 * Usada pelos testes E2E (Playwright) e pelo painel "Mock Lab" do app.
 */
import { eq, type EthString } from '@/lib/eth'
import type { EditionId } from '@/lib/api-types'
import { db, persist, resetDb } from './db'
import { broadcast, connectionCount, dropConnections } from './realtime'
import { clearScenarios, listScenarios, mockConfig, setScenario } from './scenarios'

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
    persist()
    if (!opts.silent) broadcast('nft.updated', { id: nftId, price, at: new Date().toISOString() })
  },

  changeStock(nftId: string, editionId: EditionId, stock: number, opts: { silent?: boolean } = {}) {
    const n = db.state.nfts[nftId]
    if (!n) throw new Error(`NFT ${nftId} não existe`)
    n.stock[editionId] = stock
    persist()
    if (!opts.silent) broadcast('nft.updated', { id: nftId, editionId, stock, at: new Date().toISOString() })
  },

  dropSockets: dropConnections,

  getNft: (id: string) => structuredClone(db.state.nfts[id]),
  listNftIds: () => Object.keys(db.state.nfts),
  countOrders: () => Object.keys(db.state.orders).length,
}

export type MockLab = typeof mockLab

declare global {
  interface Window {
    __kurioMock?: MockLab
    __kurioMockMode?: 'service-worker' | 'inline'
  }
}

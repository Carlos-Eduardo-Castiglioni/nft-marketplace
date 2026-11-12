/* Tipagem mínima da API do Mock Lab exposta pelo app (src/mocks/lab.ts). */
interface KurioMockLab {
  setScenario(route: string, kind: string, opts?: { times?: number }): void
  clearScenarios(): void
  changePrice(nftId: string, price: string, opts?: { silent?: boolean }): void
  changeStock(nftId: string, editionId: string, stock: number, opts?: { silent?: boolean }): void
  replayLastEvent(): void
  emitStaleNftEvent(nftId: string, price: string): void
  dropSockets(pauseMs?: number): void
  pauseSockets(): void
  resumeSockets(): void
  setPayment(outcome: 'confirm' | 'decline' | 'manual'): void
  settleOrder(id: string, outcome?: 'confirmed' | 'failed'): boolean
  listOrders(): { id: string; status: string; ownerId: string }[]
  expireSessions(): void
  countOrders(): number
  connectionCount(): number
  reset(): void
  config: { latency: number; jitter: number[]; payment: string; settleDelay: number }
}
interface Window {
  __kurioMock?: KurioMockLab
  __kurioMockMode?: 'service-worker' | 'inline'
}

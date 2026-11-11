/* Tipagem mínima da API do Mock Lab exposta pelo app (src/mocks/lab.ts). */
interface KurioMockLab {
  setScenario(route: string, kind: string, opts?: { times?: number }): void
  clearScenarios(): void
  changePrice(nftId: string, price: string, opts?: { silent?: boolean }): void
  changeStock(nftId: string, editionId: string, stock: number, opts?: { silent?: boolean }): void
  dropSockets(pauseMs?: number): void
  countOrders(): number
  connectionCount(): number
  reset(): void
}
interface Window {
  __kurioMock?: KurioMockLab
  __kurioMockMode?: 'service-worker' | 'inline'
}

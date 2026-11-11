import { test as base, expect, type Page } from '@playwright/test'

/** Latência baixa e determinística para os testes. */
export const test = base.extend<{ app: App }>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('kurio:mock-latency', '40')
    })
    await use(page)
  },
  app: async ({ page }, use) => {
    await use(new App(page))
  },
})

export { expect }

export class App {
  constructor(readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path)
    await this.waitReady()
  }

  async waitReady() {
    await this.page.waitForFunction(() => !!window.__kurioMock)
  }

  async waitRealtime() {
    await expect(this.page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
  }

  mock<T>(fn: (lab: NonNullable<Window['__kurioMock']>) => T | Promise<T>): Promise<T> {
    return this.page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (src) => (0, eval)(src)(window.__kurioMock) as any,
      `(${fn.toString()})`,
    ) as Promise<T>
  }

  async login(email = 'contato@email.com', password = 'Kurio@123') {
    await this.goto('/login')
    await this.page.getByPlaceholder('contato@email.com').fill(email)
    await this.page.getByPlaceholder('Senha').fill(password)
    await this.page.getByRole('form', { name: 'Formulário de login' }).getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(this.page.getByRole('button', { name: /Menu da conta/ })).toBeVisible()
  }

  /** Espera o grid terminar de buscar (sem placeholderData antigo). */
  async gridSettled() {
    await expect(this.page.getByTestId('catalog-grid')).toHaveAttribute('aria-busy', 'false')
  }

  async addToCart(nftId: string, quantity = 1) {
    await this.goto(`/nft/${nftId}`)
    for (let i = 1; i < quantity; i++) await this.page.getByRole('button', { name: 'Aumentar Quantidade' }).click()
    await this.page.getByRole('button', { name: 'COMPRAR' }).click()
    await this.page.waitForURL('**/cart')
  }
}

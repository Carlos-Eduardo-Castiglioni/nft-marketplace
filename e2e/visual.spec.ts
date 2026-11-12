import { test, expect, type App } from './fixtures'

/**
 * Regressão visual (@visual) de início, detalhe, carrinho e pagamento, em desktop
 * (1440) e mobile (390). Dados estáveis: seed fixo do MSW, latência baixa,
 * relógio fixo, animações desligadas e movimento reduzido.
 * Baselines: e2e/__screenshots__/<plataforma>/<projeto>/  (npm run e2e:update-snapshots)
 */
test.describe('@visual', () => {
  test.use({ reducedMotion: 'reduce' })

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-11T12:00:00-03:00'))
  })

  async function settle(app: App) {
    await app.waitRealtime()
    await app.page.waitForLoadState('networkidle')
    await app.page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(Array.from(document.images).filter((i) => !i.complete && i.loading !== 'lazy').map((i) => i.decode().catch(() => {})))
    })
  }

  const shot = (app: App, name: string) =>
    expect(app.page).toHaveScreenshot(name, { mask: [app.page.getByRole('button', { name: /Mock Lab/ })] })

  test('início', async ({ app }) => {
    await app.goto('/')
    await app.gridSettled()
    await settle(app)
    await shot(app, 'home.png')
  })

  test('detalhe do NFT', async ({ app }) => {
    await app.goto('/nft/emerald-ape-042')
    await settle(app)
    await shot(app, 'detail.png')
  })

  test('carrinho', async ({ app }) => {
    await app.addToCart('emerald-ape-042', 2)
    await settle(app)
    await shot(app, 'cart.png')
  })

  test('pagamento', async ({ page, app }) => {
    await app.login()
    await app.addToCart('emerald-ape-042')
    await app.goto('/checkout')
    await expect(page.getByTestId('confirm-order')).toBeEnabled()
    await settle(app)
    await shot(app, 'checkout.png')
  })
})

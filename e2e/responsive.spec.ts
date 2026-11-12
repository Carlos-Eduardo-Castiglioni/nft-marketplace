import { test, expect, type App } from './fixtures'

/** Larguras exigidas: 390 (mobile), 768 (tablet) e 1440 (desktop). */
const WIDTHS = [390, 768, 1440] as const
const PUBLIC = ['/', '/market', '/nft/emerald-ape-042', '/cart', '/login', '/register']
const PRIVATE = ['/checkout', '/profile', '/profile/wallets', '/profile/activity']

async function expectNoHorizontalOverflow(app: App, path: string) {
  await app.goto(path)
  await app.page.waitForLoadState('networkidle')
  const overflow = await app.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `overflow horizontal em ${path}`).toBeLessThanOrEqual(0)
}

for (const width of WIDTHS) {
  test(`sem overflow horizontal em ${width}px (telas públicas, privadas e recibo)`, async ({ page, app }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of PUBLIC) await expectNoHorizontalOverflow(app, path)

    await app.login()
    await app.addToCart('golden-signal-160')
    for (const path of PRIVATE) await expectNoHorizontalOverflow(app, path)

    await app.goto('/checkout')
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
    await expectNoHorizontalOverflow(app, new URL(page.url()).pathname)
  })
}

test('zoom de 200% (viewport equivalente a 720px) não esconde o conteúdo do checkout', async ({ page, app }) => {
  await page.setViewportSize({ width: 720, height: 450 })
  await app.login()
  await app.addToCart('golden-signal-160')
  await expectNoHorizontalOverflow(app, '/checkout')
  await page.getByTestId('confirm-order').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('confirm-order')).toBeInViewport()
})

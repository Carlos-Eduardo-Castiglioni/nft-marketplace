import { test, expect } from './fixtures'

test('mobile: filtros em drawer acessível e navegação inferior', async ({ page, app }) => {
  await app.goto('/')
  await page.getByRole('button', { name: /Abrir filtros/ }).click()
  const drawer = page.getByRole('dialog', { name: 'Filtros' })
  await expect(drawer).toBeVisible()
  await drawer.getByLabel(/^Música/).check()
  await expect(page).toHaveURL(/collections=musica/)
  await drawer.getByRole('button', { name: /Ver \d+ resultados/ }).click()
  await expect(drawer).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Abrir filtros (1 ativos)' })).toBeVisible()

  await page.getByLabel('Explorar coleções').fill('golden')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/q=golden/)
  await expect(page.getByTestId('catalog-grid').locator('h3').first()).toContainText('Golden')

  const nav = page.getByRole('navigation', { name: 'Navegação inferior' })
  await nav.getByRole('link', { name: 'Carrinho' }).click()
  await expect(page).toHaveURL(/\/cart/)
})

test('mobile: compra pelo detalhe com barra fixa', async ({ page, app }) => {
  await app.goto('/nft/emerald-ape-042')
  await page.getByRole('button', { name: 'Comprar NFT' }).click()
  await page.waitForURL('**/cart')
  await expect(page.getByTestId('cart-line-mobile')).toHaveCount(1)
})

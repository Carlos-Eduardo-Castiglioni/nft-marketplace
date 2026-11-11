import { test, expect } from './fixtures'

test('aritmética decimal exata (0.1 + 0.2 = 0.3) e cupom', async ({ page, app }) => {
  await app.addToCart('decimal-drop-001')
  await app.addToCart('decimal-drop-002')
  await expect(page.getByTestId('subtotal')).toHaveText('0.30 ETH')
  await expect(page.getByTestId('total')).toHaveText('0.316 ETH')

  const coupon = page.getByRole('textbox', { name: 'Código promocional' }).first()
  await coupon.fill('INVALIDO')
  await page.getByRole('button', { name: 'Aplicar' }).first().click()
  await expect(page.getByText('Código promocional inválido ou expirado.')).toBeVisible()

  await coupon.fill('kurio10')
  await page.getByRole('button', { name: 'Aplicar' }).first().click()
  await expect(page.getByTestId('discount')).toHaveText('(-) 0.03 ETH')
  await expect(page.getByTestId('total')).toHaveText('0.286 ETH')

  await page.reload()
  await app.waitReady()
  await expect(page.getByTestId('total')).toHaveText('0.286 ETH')
})

test('limite de quantidade por estoque e por pedido', async ({ page, app }) => {
  await app.goto('/nft/last-light-777')
  await expect(page.getByRole('radio', { name: /^1\/1 / })).toBeDisabled()
  const plus = page.getByRole('button', { name: 'Aumentar Quantidade' })
  await plus.click()
  await expect(page.getByRole('spinbutton', { name: 'Quantidade' })).toHaveAttribute('aria-valuenow', '2')
  await expect(plus).toBeDisabled()
  await expect(page.getByTestId('qty-limit')).toContainText('Limite de 2')

  // teclado: End/Home no spinbutton
  const spin = page.getByRole('spinbutton', { name: 'Quantidade' })
  await spin.focus()
  await page.keyboard.press('Home')
  await expect(spin).toHaveAttribute('aria-valuenow', '1')
  await page.keyboard.press('End')
  await expect(spin).toHaveAttribute('aria-valuenow', '2')

  await page.getByRole('button', { name: 'COMPRAR' }).click()
  await page.waitForURL('**/cart')
  await page.goto('/nft/last-light-777')
  await expect(page.getByTestId('qty-limit')).toContainText('máximo permitido')
  await expect(page.getByRole('button', { name: 'COMPRAR' })).toBeDisabled()
})

test('alterar quantidade e remover item no carrinho', async ({ page, app }) => {
  await app.addToCart('ivory-baron-088')
  await page.getByRole('button', { name: 'Aumentar Quantidade de Ivory Baron #088' }).click()
  await expect(page.getByTestId('line-total')).toHaveText('3.58 ETH')
  await expect(page.getByTestId('cart-count')).toHaveText('2')
  await page.getByRole('button', { name: 'Remover Ivory Baron #088 do carrinho' }).click()
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
})

import { test, expect } from './fixtures'

/**
 * Jornada principal pedida no desafio:
 * Filtros -> Carrinho -> Mudança de preço via Socket -> Checkout -> Recuperação de falha.
 */
test('jornada completa com mudança de preço em tempo real e recuperação idempotente', async ({ page, app }) => {
  // 1. Filtros
  await app.goto('/')
  await app.waitRealtime()
  const filters = page.getByRole('complementary', { name: 'Filtros' })
  await filters.getByLabel(/^Arte digital/).check()
  await expect(page).toHaveURL(/collections=arte-digital/)
  await page.getByTestId('catalog-grid').getByRole('link', { name: 'Emerald Ape #042', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()

  // 2. Carrinho (2 unidades da edição 1/50)
  await page.getByRole('button', { name: 'Aumentar Quantidade' }).click()
  await page.getByRole('button', { name: 'COMPRAR' }).click()
  await page.waitForURL('**/cart')
  await expect(page.getByTestId('line-total')).toHaveText('2.38 ETH')
  await expect(page.getByTestId('total')).toHaveText('2.396 ETH')

  // login exigido para finalizar (modal)
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('contato@email.com').fill('contato@email.com')
  await dialog.getByPlaceholder('Senha').fill('Kurio@123')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL('**/checkout')
  await app.waitRealtime()
  await expect(page.getByTestId('total')).toHaveText('2.396 ETH')

  // 3. Mudança de preço via Socket.IO durante o checkout
  await app.mock((lab) => lab.changePrice('emerald-ape-042', '1.25'))
  const confirm = page.getByTestId('confirm-order')
  await expect(page.getByText('O preço mudou enquanto você finalizava')).toBeVisible()
  await expect(confirm).toBeDisabled()
  await page.getByTestId('accept-prices').click()
  await expect(page.getByTestId('total')).toHaveText('2.516 ETH')
  await expect(confirm).toBeEnabled()

  // 4. Checkout com falha: o servidor efetiva o pedido mas a resposta se perde (2x)
  await app.mock((lab) => lab.setScenario('orders.create', 'timeout-after-commit', { times: 2 }))
  await confirm.click()
  await expect(page.getByText('Não conseguimos confirmar seu pedido')).toBeVisible({ timeout: 15_000 })
  expect(await app.mock((lab) => lab.countOrders())).toBe(1)

  // 5. Recuperação: reenviar com a mesma chave não duplica a compra
  await page.getByTestId('retry-order').click()
  const success = page.getByRole('dialog', { name: 'Seus NFTs agora estão na sua carteira' })
  await expect(success).toBeVisible()
  await expect(success.getByTestId('order-total')).toHaveText('2.516 ETH')
  // `order.updated` chega via socket e confirma a transação
  await expect(success.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
  expect(await app.mock((lab) => lab.countOrders())).toBe(1)

  await success.getByRole('button', { name: 'Ver minhas compras' }).click()
  await page.waitForURL('**/profile/activity')
  await expect(page.getByTestId('order-item')).toHaveCount(1)
  await expect(page.getByTestId('order-item')).toContainText('Confirmado')
  await expect(page.getByTestId('cart-count')).toHaveCount(0)
})

test('timeout simples é recuperado automaticamente com a mesma chave', async ({ page, app }) => {
  await app.login()
  await app.addToCart('golden-beat-207')
  await app.goto('/checkout')
  await app.mock((lab) => lab.setScenario('orders.create', 'timeout-after-commit', { times: 1 }))
  await page.getByTestId('confirm-order').click()
  await expect(page.getByRole('dialog', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible({ timeout: 15_000 })
  expect(await app.mock((lab) => lab.countOrders())).toBe(1)
})

test('erro 500 no pedido mostra opção de tentar novamente', async ({ page, app }) => {
  await app.login()
  await app.addToCart('golden-signal-160')
  await app.goto('/checkout')
  await app.mock((lab) => lab.setScenario('orders.create', 'server-error', { times: 2 }))
  await page.getByTestId('confirm-order').click()
  await expect(page.getByTestId('retry-order')).toBeVisible()
  expect(await app.mock((lab) => lab.countOrders())).toBe(0)
  await page.getByTestId('retry-order').click()
  await expect(page.getByRole('dialog', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  expect(await app.mock((lab) => lab.countOrders())).toBe(1)
})

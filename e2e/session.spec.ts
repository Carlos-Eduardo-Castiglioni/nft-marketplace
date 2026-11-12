import { test, expect, type App } from './fixtures'

async function logout(app: App) {
  await app.page.getByRole('button', { name: /Menu da conta/ }).click()
  await app.page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(app.page.getByRole('button', { name: 'Entrar' })).toBeVisible()
}

test('itens do visitante são preservados ao autenticar', async ({ page, app }) => {
  await app.addToCart('golden-beat-207')
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await app.login()
  await app.goto('/cart')
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByTestId('cart-line')).toContainText('Golden Beat #207')
  // e continuam após refresh
  await page.reload()
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
})

test('troca de usuário não expõe carrinho, favoritos nem pedidos da sessão anterior', async ({ page, app }) => {
  // usuário A: carrinho + pedido confirmado
  await app.login()
  await app.addToCart('cosmic-bloom-118')
  await app.goto('/checkout')
  await page.getByTestId('confirm-order').click()
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
  await app.addToCart('violet-nomad-314')
  await expect(page.getByTestId('cart-line')).toHaveCount(1)

  await logout(app)
  // visitante: carrinho novo e vazio
  await app.goto('/cart')
  await expect(page.getByTestId('cart-line')).toHaveCount(0)

  // usuário B: só vê os próprios dados
  await app.login('rafa@email.com', 'Kurio@456')
  await expect(page.getByRole('button', { name: 'Menu da conta de Rafa Lume' })).toBeVisible()
  await app.goto('/cart')
  await expect(page.getByTestId('cart-line')).toHaveCount(0)
  await app.goto('/profile/activity')
  await expect(page.getByText('Nenhuma compra ainda.')).toBeVisible()
  await app.goto('/profile/favorites')
  await expect(page.getByText('Golden Beat #207')).toBeVisible()

  // A volta e reencontra o próprio carrinho
  await logout(app)
  await app.login()
  await app.goto('/cart')
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByTestId('cart-line')).toContainText('Violet Nomad #314')
})

test('evento de pedido de uma sessão anterior não chega à sessão seguinte', async ({ page, app }) => {
  await app.login()
  await app.addToCart('golden-signal-160')
  await app.goto('/checkout')
  await app.mock((lab) => lab.setPayment('manual'))
  await page.getByTestId('confirm-order').click()
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')

  await logout(app)
  await app.login('rafa@email.com', 'Kurio@456')
  await app.goto('/profile/activity')
  await app.waitRealtime()
  const before = await page.evaluate(() => (window as unknown as { __kurioRealtime: { applied: number } }).__kurioRealtime.applied)
  await app.mock((lab) => {
    const pending = lab.listOrders().find((o) => o.status === 'pending')!
    lab.settleOrder(pending.id, 'confirmed')
  })
  // o servidor não entrega `order.updated` de A para a conexão de B
  await page.waitForTimeout(300)
  const after = await page.evaluate(() => (window as unknown as { __kurioRealtime: { applied: number; ignored: number } }).__kurioRealtime)
  expect(after.applied - before).toBeLessThanOrEqual(1) // no máximo o `nft.updated` público de estoque
  await expect(page.getByText('Pagamento confirmado na rede.')).toHaveCount(0)
  await expect(page.getByText('Nenhuma compra ainda.')).toBeVisible()
})

test('sessão expirada no checkout leva ao login e retoma o fluxo com o carrinho', async ({ page, app }) => {
  await app.login()
  await app.addToCart('emerald-ape-042')
  await app.goto('/checkout')
  await app.mock((lab) => lab.expireSessions())

  // a expiração é detectada na próxima requisição autenticada — o clique em
  // confirmar ou uma revalidação em segundo plano, o que vier primeiro
  await Promise.race([page.getByTestId('confirm-order').click().catch(() => {}), page.waitForURL(/\/login/)])
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
  await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar.')).toBeVisible()
  expect(await app.mock((lab) => lab.countOrders())).toBe(0)

  await page.getByPlaceholder('contato@email.com').fill('contato@email.com')
  await page.getByPlaceholder('Senha').fill('Kurio@123')
  await page.getByRole('form', { name: 'Formulário de login' }).getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL('**/checkout')
  await expect(page.getByText('Emerald Ape #042')).toBeVisible()
  await page.getByTestId('confirm-order').click()
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
  expect(await app.mock((lab) => lab.countOrders())).toBe(1)
})

test('sessão expirada durante a navegação limpa dados privados', async ({ page, app }) => {
  await app.login()
  await app.goto('/profile')
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Nova Seto')
  await app.mock((lab) => lab.expireSessions())
  await page.getByRole('link', { name: 'Carteiras' }).first().click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('button', { name: /Menu da conta/ })).toHaveCount(0)
})

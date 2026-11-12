import { test, expect, type App } from './fixtures'

async function startCheckout(app: App, nftId: string) {
  await app.login()
  await app.addToCart(nftId)
  await app.goto('/checkout')
  await app.waitRealtime()
}

const orderIdFromUrl = (url: string) => url.match(/orders\/(ord-[\w-]+)/)![1]

test('pagamento recusado: pedido terminal "failed", sem recibo e itens preservados', async ({ page, app }) => {
  await startCheckout(app, 'golden-beat-207')
  await app.mock((lab) => lab.setPayment('decline'))
  await page.getByTestId('confirm-order').click()
  await page.waitForURL(/\/orders\/ord-/)

  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'failed')
  await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
  await expect(page.getByText('Pagamento recusado pela carteira (simulado).').first()).toBeVisible()
  await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toHaveCount(0)
  await expect(page.getByTestId('order-total')).toHaveCount(0)

  await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByTestId('cart-line')).toContainText('Golden Beat #207')

  // nova tentativa (agora aprovada) cria outro pedido e confirma
  await app.goto('/checkout')
  await app.mock((lab) => lab.setPayment('confirm'))
  await page.getByTestId('confirm-order').click()
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
  expect(await app.mock((lab) => lab.countOrders())).toBe(2)
})

test('cliques repetidos no confirmar criam um único pedido', async ({ page, app }) => {
  await startCheckout(app, 'golden-signal-160')
  await page.getByTestId('confirm-order').evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
    button.click()
  })
  await page.waitForURL(/\/orders\/ord-/)
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
  expect(await app.mock((lab) => lab.countOrders())).toBe(1)
})

test('pedido pendente sobrevive a refresh e à queda do socket sem criar outra compra', async ({ page, app }) => {
  await startCheckout(app, 'sage-nomad-009')
  await app.mock((lab) => lab.setPayment('manual'))
  await page.getByTestId('confirm-order').click()
  await page.waitForURL(/\/orders\/ord-/)
  const orderId = orderIdFromUrl(page.url())

  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')
  await expect(page.getByRole('heading', { name: 'Aguardando confirmação na rede' })).toBeVisible()
  await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toHaveCount(0)

  // refresh com o pedido pendente: o estado é recuperado via REST
  await page.reload()
  await app.waitReady()
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'pending')

  // voltar ao checkout não permite comprar de novo enquanto houver pedido pendente
  await app.goto('/checkout')
  await expect(page.getByText('Há um pedido aguardando confirmação')).toBeVisible()
  await expect(page.getByTestId('confirm-order')).toBeDisabled()
  await page.getByRole('button', { name: 'Acompanhar pedido' }).click()
  await page.waitForURL(`**/orders/${orderId}`)
  await app.waitRealtime()

  // queda do socket: a confirmação acontece enquanto o cliente está desconectado
  await app.mock((lab) => lab.pauseSockets())
  await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'reconnecting')
  await expect(page.getByText('Reconectando ao tempo real')).toBeVisible()
  await app.mock((lab) => {
    const pending = lab.listOrders().find((o) => o.status === 'pending')!
    lab.settleOrder(pending.id, 'confirmed')
  })
  await app.mock((lab) => lab.resumeSockets())

  // ao reconectar, o cliente reconcilia com o REST e mostra o recibo
  await app.waitRealtime()
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  expect(await app.mock((lab) => lab.countOrders())).toBe(1)

  // terminal: um evento antigo/duplicado não regride o estado
  await app.mock((lab) => lab.replayLastEvent())
  await page.reload()
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-status', 'confirmed')
})

test('após confirmação, só os itens comprados saem do carrinho', async ({ page, app }) => {
  await startCheckout(app, 'golden-beat-207')
  await app.mock((lab) => lab.setPayment('manual'))
  await page.getByTestId('confirm-order').click()
  await page.waitForURL(/\/orders\/ord-/)

  // enquanto o pedido está pendente, o colecionador adiciona outro NFT
  await app.addToCart('violet-nomad-314')
  await expect(page.getByTestId('cart-line')).toHaveCount(2)

  await app.mock((lab) => {
    const pending = lab.listOrders().find((o) => o.status === 'pending')!
    lab.settleOrder(pending.id, 'confirmed')
  })
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByTestId('cart-line')).toContainText('Violet Nomad #314')
})

test('recibo de outro usuário não é acessível', async ({ page, app }) => {
  await startCheckout(app, 'golden-signal-160')
  await page.getByTestId('confirm-order').click()
  await page.waitForURL(/\/orders\/ord-/)
  const orderUrl = new URL(page.url()).pathname

  await page.getByRole('button', { name: /Menu da conta/ }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await app.login('rafa@email.com', 'Kurio@456')
  await app.goto(orderUrl)
  await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
})

test('pedido inexistente mostra estado de não encontrado', async ({ page, app }) => {
  await app.login()
  await app.goto('/orders/ord-naoexiste')
  await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
})

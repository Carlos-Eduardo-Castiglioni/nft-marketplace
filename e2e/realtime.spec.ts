import { test, expect } from './fixtures'

test('nft.updated atualiza preço no catálogo e no detalhe em tempo real', async ({ page, app }) => {
  await app.goto('/nft/sage-nomad-009')
  await app.waitRealtime()
  await expect(page.getByTestId('detail-price')).toHaveText(/1\.69 ETH/)
  await app.mock((lab) => lab.changePrice('sage-nomad-009', '2.05'))
  await expect(page.getByTestId('detail-price')).toHaveText(/2\.05 ETH/)
})

test('após reconexão, dados perdidos são reconciliados via REST', async ({ page, app }) => {
  await app.goto('/nft/violet-nomad-314')
  await app.waitRealtime()
  await expect(page.getByTestId('detail-price')).toHaveText(/1\.39 ETH/)

  // derruba o socket e recusa reconexões por 1.5s; durante a queda o preço muda "em silêncio"
  await app.mock((lab) => lab.dropSockets(1500))
  await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'reconnecting')
  await app.mock((lab) => lab.changePrice('violet-nomad-314', '1.77', { silent: true }))
  await expect(page.getByTestId('detail-price')).toHaveText(/1\.39 ETH/)

  await app.waitRealtime()
  await expect(page.getByTestId('detail-price')).toHaveText(/1\.77 ETH/)
})

test('alteração de estoque via socket respeita limite de quantidade', async ({ page, app }) => {
  await app.goto('/nft/cosmic-bloom-118')
  await app.waitRealtime()
  await app.mock((lab) => lab.changeStock('cosmic-bloom-118', '1/50', 0))
  await expect(page.getByRole('button', { name: 'COMPRAR' })).toBeDisabled()
})

test('nenhum WebSocket real sai do navegador (tudo interceptado pelo MSW)', async ({ page, app }) => {
  const real: string[] = []
  page.on('websocket', (ws) => real.push(ws.url()))
  await app.goto('/')
  await app.waitRealtime()
  expect(real).toEqual([])
})

test('modo inline (sem Service Worker): REST e Socket.IO continuam simulados', async ({ page, app }) => {
  const real: string[] = []
  page.on('websocket', (ws) => real.push(ws.url()))
  await app.goto('/nft/golden-signal-160?mockMode=inline')
  expect(await page.evaluate(() => window.__kurioMockMode)).toBe('inline')
  await app.waitRealtime()
  await expect(page.getByTestId('detail-price')).toHaveText(/0\.39 ETH/)
  await app.mock((lab) => lab.changePrice('golden-signal-160', '0.45'))
  await expect(page.getByTestId('detail-price')).toHaveText(/0\.45 ETH/)
  expect(real).toEqual([])
})

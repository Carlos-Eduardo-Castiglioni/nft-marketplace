import { test, expect } from './fixtures'

test('catálogo com 5xx persistente mostra erro e permite tentar de novo', async ({ page, app }) => {
  // 1 tentativa + 2 retries automáticos = 3 falhas até exibir o erro
  await page.goto('/?mock=nfts.list:server-error:3')
  await app.waitReady()
  await expect(page.getByText('Não foi possível carregar os NFTs')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
})

test('falha transitória é absorvida pelo retry automático', async ({ page, app }) => {
  await page.goto('/?mock=nfts.list:network-error:1')
  await app.waitReady()
  await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
  await expect(page.getByText('Não foi possível carregar os NFTs')).toHaveCount(0)
})

test('skeletons aparecem com latência alta', async ({ page, app }) => {
  await page.goto('/?mock=nfts.list:slow:1')
  await app.waitReady()
  await expect(page.getByTestId('nft-card-skeleton').first()).toBeVisible()
  await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9, { timeout: 10_000 })
})

test('NFT inexistente mostra 404', async ({ page, app }) => {
  await app.goto('/nft/nao-existe')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})

test('favoritar é otimista e faz rollback em erro', async ({ page, app }) => {
  await app.goto('/nft/emerald-ape-042')
  const fav = page.getByRole('button', { name: /^(Favoritar|Favoritado)$/ })
  await fav.click()
  await expect(fav).toHaveAttribute('aria-pressed', 'true')
  await expect(fav).toHaveText('Favoritado')

  await app.mock((lab) => lab.setScenario('nfts.favorite', 'server-error', { times: 1 }))
  await fav.click()
  // otimista: desmarca na hora…
  await expect(fav).toHaveAttribute('aria-pressed', 'false')
  // …e volta quando o servidor falha
  await expect(fav).toHaveAttribute('aria-pressed', 'true')
})

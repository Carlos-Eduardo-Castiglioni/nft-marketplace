import { test, expect } from './fixtures'

test.describe('Catálogo', () => {
  test('filtros, ordenação e busca sincronizam com a URL e sobrevivem ao refresh', async ({ page, app }) => {
    await app.goto('/')
    const grid = page.getByTestId('catalog-grid')
    await expect(grid.getByTestId('nft-card')).toHaveCount(9)

    const filters = page.getByRole('complementary', { name: 'Filtros' })
    await filters.getByLabel(/^Música/).check()
    await expect(page).toHaveURL(/collections=musica/)
    await filters.getByLabel(/^Polygon/).check()
    await expect(page).toHaveURL(/networks=polygon/)

    await page.getByRole('combobox', { name: 'Ordenar por' }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=price-asc/)
    await app.gridSettled()

    // todos os resultados pertencem aos filtros e estão em ordem crescente
    const prices = async () =>
      (await grid.getByTestId('nft-card').locator('p').first().allTextContents()).length
    expect(await prices()).toBeGreaterThan(0)
    const names = await grid.getByTestId('nft-card').locator('h3').allTextContents()
    expect(names).toContain('Golden Beat #207')

    const values = (await grid.getByTestId('nft-card').locator('p .font-bold').allTextContents()).map((t) => parseFloat(t))
    expect([...values].sort((a, b) => a - b)).toEqual(values)

    await page.reload()
    await app.waitReady()
    await expect(page).toHaveURL(/collections=musica/)
    await expect(filters.getByLabel(/^Música/)).toBeChecked()
    await expect(filters.getByLabel(/^Polygon/)).toBeChecked()
    await expect(page.getByRole('combobox', { name: 'Ordenar por' })).toHaveText(/Menor preço/)
    await expect(grid.getByTestId('nft-card').locator('h3').first()).toHaveText(names[0])

    // voltar no histórico desfaz o último filtro
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=price-asc/)
  })

  test('faixa de preço e paginação', async ({ page, app }) => {
    await app.goto('/')
    await page.getByRole('navigation', { name: 'Paginação' }).getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    const filters = page.getByRole('complementary', { name: 'Filtros' })
    const max = filters.getByRole('slider', { name: 'Preço máximo' })
    await max.focus()
    for (let i = 0; i < 40; i++) await page.keyboard.press('PageDown')
    await filters.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page).toHaveURL(/maxPrice=/)
    await expect(page).not.toHaveURL(/page=2/) // filtro novo volta para a página 1
    await app.gridSettled()
    const maxPrice = Number(new URL(page.url()).searchParams.get('maxPrice'))
    const values = (await page.getByTestId('catalog-grid').locator('[data-testid=nft-card] p .font-bold').allTextContents()).map(parseFloat)
    expect(values.length).toBeGreaterThan(0)
    for (const v of values) expect(v).toBeLessThanOrEqual(maxPrice)
  })

  test('URL inválida cai nos padrões sem quebrar', async ({ page, app }) => {
    await app.goto('/?sort=hack&page=-3&minPrice=abc&tab=oops')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
    await expect(page.getByRole('tab', { name: 'Todos os NFTs' })).toHaveAttribute('aria-selected', 'true')
  })

  test('abas de "Novos lançamentos" e "Em alta"', async ({ page, app }) => {
    await app.goto('/')
    await page.getByRole('tab', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/tab=trending/)
    await expect(page.getByRole('tab', { name: 'Em alta' })).toHaveAttribute('aria-selected', 'true')
  })
})

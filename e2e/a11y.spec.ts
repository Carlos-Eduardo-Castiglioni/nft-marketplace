import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

const PAGES = ['/', '/market', '/nft/emerald-ape-042', '/cart', '/login', '/register']

for (const path of PAGES) {
  test(`sem violações de acessibilidade (axe) em ${path}`, async ({ page, app }) => {
    await app.goto(path)
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa']).exclude('[data-sonner-toaster]').analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
}

test('modal de login: abre por teclado, prende o foco, fecha com Esc e devolve o foco', async ({ page, app }) => {
  await app.goto('/')
  const trigger = page.getByRole('button', { name: 'Entrar' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Entrar na Kurio' })
  await expect(dialog).toBeVisible()

  // foco fica preso dentro do modal
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  }
  // alterna para "Criar conta"
  await dialog.getByRole('tab', { name: 'Criar conta' }).click()
  await expect(page.getByRole('dialog', { name: 'Criar conta na Kurio' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('modal de login via teclado: submete com Enter', async ({ page, app }) => {
  await app.goto('/')
  await page.getByRole('button', { name: 'Entrar' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('contato@email.com').fill('contato@email.com')
  await dialog.getByPlaceholder('Senha').fill('Kurio@123')
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Menu da conta/ })).toBeVisible()
})

test('seletor de edição navegável por setas', async ({ page, app }) => {
  await app.goto('/nft/emerald-ape-042')
  const selected = page.getByRole('radio', { checked: true })
  await expect(selected).toHaveText(/1\/50/)
  await selected.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { checked: true })).toHaveText(/ABERTA/)
  await expect(page.getByRole('radio', { checked: true })).toBeFocused()
})

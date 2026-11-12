import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

/** Gera um PNG válido no próprio navegador (canvas) para o upload. */
async function makePng(page: Page) {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 300
    c.height = 200
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#c87f4a'
    ctx.fillRect(0, 0, 300, 200)
    return c.toDataURL('image/png')
  })
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

test('edição do perfil valida campos e persiste após refresh', async ({ page, app }) => {
  await app.login()
  await app.goto('/profile')
  const name = page.getByLabel('Nome de exibição')
  await expect(name).toHaveValue('Nova Seto')

  await name.fill('N')
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('invalido')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Mínimo de 2 caracteres.')).toBeVisible()
  await expect(page.getByText('E-mail inválido.')).toBeVisible()
  await expect(name).toHaveAttribute('aria-invalid', 'true')

  // conflito vindo da API: e-mail de outro usuário
  await name.fill('Nova Seto Silva')
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('rafa@email.com')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()

  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('contato@email.com')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Perfil atualizado!')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Nova Seto Silva')
  await expect(page.getByRole('button', { name: 'Menu da conta de Nova Seto Silva' })).toBeVisible()
})

test('avatar: upload real, persistência, arquivo inválido e remoção', async ({ page, app }) => {
  await app.login()
  await app.goto('/profile')
  const input = page.getByLabel('Arquivo do avatar')

  await input.setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('não é imagem') })
  await expect(page.getByRole('alert').filter({ hasText: 'Selecione um arquivo de imagem' })).toBeVisible()
  await expect(page.getByTestId('avatar-image')).toHaveCount(0)

  await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: await makePng(page) })
  await expect(page.getByText('Avatar atualizado!')).toBeVisible()
  await expect(page.getByTestId('avatar-image')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)

  await page.reload()
  await expect(page.getByTestId('avatar-image')).toBeVisible()

  await page.getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByText('Avatar removido.')).toBeVisible()
  await expect(page.getByTestId('avatar-image')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('avatar-image')).toHaveCount(0)
})

test('alteração de senha: validação, erro da API e login com a nova senha', async ({ page, app }) => {
  await app.login()
  await app.goto('/profile')
  const current = page.getByLabel('Senha atual')
  const next = page.getByLabel('Nova senha', { exact: true })
  const confirm = page.getByLabel('Confirmar nova senha')
  const save = page.getByRole('button', { name: 'Salvar' })

  await next.fill('Nova@2026x')
  await confirm.fill('Outra@2026x')
  await save.click()
  await expect(page.getByText('Informe a senha atual.')).toBeVisible()
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible()

  await current.fill('senha-errada1')
  await confirm.fill('Nova@2026x')
  await save.click()
  await expect(page.getByText('Senha atual incorreta.')).toBeVisible()
  await expect(current).toHaveAttribute('aria-invalid', 'true')

  await current.fill('Kurio@123')
  await save.click()
  await expect(page.getByText('Perfil atualizado!')).toBeVisible()

  // a senha nunca fica em claro no "banco" persistido do mock
  const raw = await page.evaluate(() => localStorage.getItem('kurio:mock-db') ?? '')
  expect(raw).not.toContain('Nova@2026x')
  expect(raw).not.toContain('Kurio@123')

  await page.getByRole('button', { name: /Menu da conta/ }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await app.goto('/login')
  await page.getByPlaceholder('contato@email.com').fill('contato@email.com')
  await page.getByPlaceholder('Senha').fill('Kurio@123')
  await page.getByRole('form', { name: 'Formulário de login' }).getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
  await app.login('contato@email.com', 'Nova@2026x')
})

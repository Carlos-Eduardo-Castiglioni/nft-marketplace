import { test, expect } from './fixtures'

test('rota privada redireciona para login e volta após autenticar', async ({ page, app }) => {
  await app.goto('/profile/wallets')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.getByRole('form', { name: 'Formulário de login' }).getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Informe seu e-mail.')).toBeVisible()
  await expect(page.getByText('Informe sua senha.')).toBeVisible()

  await page.getByPlaceholder('contato@email.com').fill('contato@email.com')
  await page.getByPlaceholder('Senha').fill('errada')
  await page.getByRole('form', { name: 'Formulário de login' }).getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
  await expect(page.getByPlaceholder('Senha')).toHaveAttribute('aria-invalid', 'true')

  await page.getByPlaceholder('Senha').fill('Kurio@123')
  await page.getByRole('form', { name: 'Formulário de login' }).getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL('**/profile/wallets')
  await expect(page.getByTestId('wallet-card-principal')).toBeVisible()

  // sessão persiste no refresh
  await page.reload()
  await expect(page.getByTestId('wallet-card-principal')).toBeVisible()
})

test('cadastro valida com Zod e cria sessão', async ({ page, app }) => {
  await app.goto('/register')
  await page.getByPlaceholder('Nome de usuário').fill('ab')
  await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill('contato@email.com')
  await page.getByPlaceholder('Senha', { exact: true }).fill('abc12345')
  await page.getByPlaceholder('Confirmar senha').fill('abc12346')
  await page.getByRole('button', { name: 'Criar perfil' }).click()
  await expect(page.getByText('Mínimo de 3 caracteres.')).toBeVisible()
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible()

  await page.getByPlaceholder('Nome de usuário').fill('novo_colecionador')
  await page.getByPlaceholder('Confirmar senha').fill('abc12345')
  await page.getByRole('button', { name: 'Criar perfil' }).click()
  await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()

  await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill('novo@kurio.io')
  await page.getByRole('button', { name: 'Criar perfil' }).click()
  await page.waitForURL('**/profile')
  await expect(page.getByLabel('Nome de usuário')).toHaveValue('novo_colecionador')
})

test('logout encerra a sessão e protege rotas novamente', async ({ page, app }) => {
  await app.login()
  await page.getByRole('button', { name: /Menu da conta/ }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  await page.goto('/checkout')
  await expect(page).toHaveURL(/\/login/)
})

test('carteiras: promover reserva a principal e validar endereço', async ({ page, app }) => {
  await app.login()
  await app.goto('/profile/wallets')
  const reserva = page.getByTestId('wallet-card-reserva')
  await expect(reserva).toContainText('Reserva')
  await reserva.getByRole('button', { name: 'Tornar principal' }).click()
  await expect(page.getByTestId('wallet-card-principal')).toContainText('Reserva')
  await expect(page.getByTestId('wallet-card-reserva')).toContainText('Principal')

  await page.getByRole('region', { name: 'Carteira principal' }).getByRole('button', { name: 'Editar' }).click()
  const form = page.getByRole('form', { name: 'Formulário da carteira principal' })
  await form.getByLabel('Endereço da carteira').fill('0x123')
  await form.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(form.getByText('Use um endereço 0x (40 hex) ou um nome .eth.')).toBeVisible()
  await form.getByLabel('Endereço da carteira').fill('0x' + 'ab'.repeat(20))
  await form.getByLabel('ENS (opcional)').fill('')
  await form.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(page.getByTestId('wallet-card-principal')).toContainText('0xabab')
})

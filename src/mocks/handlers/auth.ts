import { http, HttpResponse } from 'msw'
import type { NetworkId, Session, Wallet, WalletProvider } from '@/lib/api-types'
import { uuid } from '@/lib/utils'
import { db, persist, type UserRecord } from '../db'
import { apiError, getUser, publicUser, requireUser, withScenario } from '../http'

function createSession(user: UserRecord): Session {
  const token = `tok_${uuid()}`
  db.state.sessions[token] = user.id
  persist()
  return { token, user: publicUser(user) }
}

const findByEmail = (email: string) =>
  Object.values(db.state.users).find((u) => u.email.toLowerCase() === email.toLowerCase())

export const authHandlers = [
  http.get(
    '*/api/auth/session',
    withScenario('auth.session', ({ request }) => {
      const user = getUser(request)
      if (!user) return apiError(401, 'UNAUTHORIZED', 'Sessão inválida.')
      const token = request.headers.get('authorization')!.slice(7)
      return HttpResponse.json<Session>({ token, user: publicUser(user) })
    }),
  ),

  http.post(
    '*/api/auth/login',
    withScenario('auth.login', async ({ request }) => {
      const { email, password } = (await request.json()) as { email: string; password: string }
      const user = findByEmail(email ?? '')
      if (!user || user.password !== password) {
        return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      }
      return HttpResponse.json(createSession(user))
    }),
  ),

  http.post(
    '*/api/auth/oauth/:provider',
    withScenario('auth.login', ({ params }) => {
      const provider = params.provider as string
      const email = `${provider}.colecionador@email.com`
      let user = findByEmail(email)
      if (!user) {
        user = {
          id: `user-${uuid()}`,
          username: `${provider}_colecionador`,
          displayName: `Colecionador ${provider === 'google' ? 'Google' : 'Facebook'}`,
          email,
          password: uuid(),
          ensName: '',
          walletNickname: '',
        }
        db.state.users[user.id] = user
      }
      return HttpResponse.json(createSession(user))
    }),
  ),

  http.post(
    '*/api/auth/register',
    withScenario('auth.register', async ({ request }) => {
      const body = (await request.json()) as { username: string; email: string; password: string }
      if (findByEmail(body.email ?? '')) {
        return apiError(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', { field: 'email' })
      }
      if (Object.values(db.state.users).some((u) => u.username === body.username)) {
        return apiError(409, 'USERNAME_TAKEN', 'Nome de usuário indisponível.', { field: 'username' })
      }
      const user: UserRecord = {
        id: `user-${uuid()}`,
        username: body.username,
        displayName: body.username,
        email: body.email,
        password: body.password,
        ensName: '',
        walletNickname: '',
      }
      db.state.users[user.id] = user
      return HttpResponse.json(createSession(user), { status: 201 })
    }),
  ),

  http.post('*/api/auth/logout', ({ request }) => {
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) delete db.state.sessions[auth.slice(7)]
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('*/api/auth/forgot-password', async () => HttpResponse.json({ ok: true })),
]

export const profileHandlers = [
  http.get(
    '*/api/profile',
    withScenario('profile', ({ request }) => HttpResponse.json(publicUser(requireUser(request)))),
  ),

  http.put(
    '*/api/profile',
    withScenario('profile', async ({ request }) => {
      const user = requireUser(request)
      const body = (await request.json()) as Partial<UserRecord> & { currentPassword?: string; newPassword?: string }
      if (body.email && body.email !== user.email && findByEmail(body.email)) {
        return apiError(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', { field: 'email' })
      }
      if (body.newPassword) {
        if (body.currentPassword !== user.password) {
          return apiError(422, 'WRONG_PASSWORD', 'Senha atual incorreta.', { field: 'currentPassword' })
        }
        user.password = body.newPassword
      }
      for (const k of ['displayName', 'username', 'email', 'ensName', 'walletNickname', 'avatarUrl'] as const) {
        if (body[k] !== undefined) (user as unknown as Record<string, unknown>)[k] = body[k]
      }
      persist()
      return HttpResponse.json(publicUser(user))
    }),
  ),

  http.get(
    '*/api/wallets',
    withScenario('wallets', ({ request }) => HttpResponse.json(db.state.wallets[requireUser(request).id] ?? [])),
  ),

  http.post(
    '*/api/wallets',
    withScenario('wallets', async ({ request }) => {
      const user = requireUser(request)
      const body = (await request.json()) as {
        role: Wallet['role']
        nickname: string
        address: string
        ensName?: string
        network: NetworkId
        provider: WalletProvider
      }
      const list = db.state.wallets[user.id] ?? []
      // só existe uma carteira por papel: a nova substitui a anterior no mesmo papel
      const wallet: Wallet = { id: `wallet-${uuid()}`, ...body }
      db.state.wallets[user.id] = [...list.filter((w) => w.role !== body.role), wallet]
      persist()
      return HttpResponse.json(wallet, { status: 201 })
    }),
  ),

  http.post(
    '*/api/wallets/:id/promote',
    withScenario('wallets', ({ request, params }) => {
      const user = requireUser(request)
      const list = db.state.wallets[user.id] ?? []
      const target = list.find((w) => w.id === params.id)
      if (!target) return apiError(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.')
      // troca os papéis: a escolhida vira principal; a antiga principal vira reserva
      for (const w of list) w.role = w.id === target.id ? 'principal' : 'reserva'
      persist()
      return HttpResponse.json(list)
    }),
  ),

  http.delete(
    '*/api/wallets/:id',
    withScenario('wallets', ({ request, params }) => {
      const user = requireUser(request)
      db.state.wallets[user.id] = (db.state.wallets[user.id] ?? []).filter((w) => w.id !== params.id)
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]

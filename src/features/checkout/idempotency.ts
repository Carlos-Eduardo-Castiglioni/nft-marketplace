import { safeStorage, uuid } from '@/lib/utils'

/**
 * Gerencia a chave de idempotência do checkout.
 *
 * A chave é derivada de uma "intenção de compra" (versão do carrinho +
 * carteira + provedor). Enquanto a intenção for a mesma, toda nova tentativa —
 * inclusive após refresh da página — reutiliza a mesma chave, então o servidor
 * nunca cria um segundo pedido. Ao concluir (ou mudar a intenção), a chave é
 * descartada.
 */
const KEY = 'kurio:checkout-attempt'

interface Attempt {
  intent: string
  key: string
  createdAt: number
}

export function intentOf(input: { cartVersion: number; walletId: string; provider: string; total?: string }) {
  return `${input.cartVersion}|${input.walletId}|${input.provider}|${input.total ?? ''}`
}

function read(): Attempt | null {
  try {
    const raw = safeStorage('session')?.getItem(KEY)
    return raw ? (JSON.parse(raw) as Attempt) : null
  } catch {
    return null
  }
}

export const idempotency = {
  keyFor(intent: string): string {
    const current = read()
    if (current && current.intent === intent) return current.key
    const next: Attempt = { intent, key: `idem_${uuid()}`, createdAt: Date.now() }
    safeStorage('session')?.setItem(KEY, JSON.stringify(next))
    return next.key
  },
  peek: read,
  clear() {
    safeStorage('session')?.removeItem(KEY)
  },
}

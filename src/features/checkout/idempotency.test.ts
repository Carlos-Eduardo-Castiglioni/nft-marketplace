import { idempotency, intentOf } from './idempotency'

describe('idempotency', () => {
  beforeEach(() => sessionStorage.clear())

  it('reutiliza a mesma chave para a mesma intenção', () => {
    const intent = intentOf({ cartVersion: 3, walletId: 'w1', provider: 'metamask' })
    const a = idempotency.keyFor(intent)
    const b = idempotency.keyFor(intent)
    expect(a).toBe(b)
    expect(a).toMatch(/^idem_/)
  })

  it('gera nova chave quando a intenção muda', () => {
    const a = idempotency.keyFor(intentOf({ cartVersion: 3, walletId: 'w1', provider: 'metamask' }))
    const b = idempotency.keyFor(intentOf({ cartVersion: 4, walletId: 'w1', provider: 'metamask' }))
    expect(a).not.toBe(b)
  })

  it('sobrevive a "refresh" (persistida no sessionStorage) e pode ser limpa', () => {
    const intent = intentOf({ cartVersion: 1, walletId: 'w', provider: 'coinbase' })
    const a = idempotency.keyFor(intent)
    expect(JSON.parse(sessionStorage.getItem('kurio:checkout-attempt')!).key).toBe(a)
    idempotency.clear()
    expect(idempotency.peek()).toBeNull()
    expect(idempotency.keyFor(intent)).not.toBe(a)
  })
})

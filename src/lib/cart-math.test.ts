import { COUPONS, computeTotals } from './cart-math'

describe('computeTotals', () => {
  it('soma linhas com quantidades (itens do carrinho mobile do Figma)', () => {
    const t = computeTotals([
      { unitPrice: '1.19', quantity: 1 },
      { unitPrice: '1.39', quantity: 1 },
      { unitPrice: '1.79', quantity: 2 },
      { unitPrice: '0.99', quantity: 2 },
    ])
    expect(t).toEqual({ subtotal: '8.14', discount: '0', networkFee: '0.016', total: '8.156' })
  })

  it('aplica cupom percentual com precisão', () => {
    const t = computeTotals([{ unitPrice: '0.1', quantity: 1 }, { unitPrice: '0.2', quantity: 1 }], COUPONS.KURIO10)
    expect(t.subtotal).toBe('0.3')
    expect(t.discount).toBe('0.03')
    expect(t.total).toBe('0.286')
  })

  it('desconto fixo não ultrapassa o subtotal', () => {
    const t = computeTotals([{ unitPrice: '0.02', quantity: 1 }], COUPONS.LAUNCH)
    expect(t.discount).toBe('0.02')
    expect(t.total).toBe('0.016')
  })

  it('carrinho vazio não cobra taxa', () => {
    expect(computeTotals([])).toEqual({ subtotal: '0', discount: '0', networkFee: '0', total: '0' })
  })
})

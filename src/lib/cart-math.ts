import { add, mulInt, percentOf, sub, max, type EthString } from './eth'

export const NETWORK_FEE: EthString = '0.016'

export interface Coupon {
  code: string
  label: string
  /** percentual em pontos-base OU valor fixo em ETH */
  percentBps?: number
  fixed?: EthString
}

export const COUPONS: Record<string, Coupon> = {
  KURIO10: { code: 'KURIO10', label: '10% de desconto do lançamento', percentBps: 1000 },
  LAUNCH: { code: 'LAUNCH', label: 'Desconto do lançamento', fixed: '0.05' },
}

export interface PricedLine {
  unitPrice: EthString
  quantity: number
}

export function lineTotal(line: PricedLine): EthString {
  return mulInt(line.unitPrice, line.quantity)
}

export function computeTotals(lines: PricedLine[], coupon?: Coupon) {
  const subtotal = lines.length ? add(...lines.map(lineTotal)) : '0'
  let discount: EthString = '0'
  if (coupon?.percentBps) discount = percentOf(subtotal, coupon.percentBps)
  if (coupon?.fixed) discount = coupon.fixed
  // desconto nunca maior que o subtotal
  discount = sub(subtotal, max(sub(subtotal, discount), '0'))
  const networkFee = lines.length ? NETWORK_FEE : '0'
  const total = add(sub(subtotal, discount), networkFee)
  return { subtotal, discount, networkFee, total }
}

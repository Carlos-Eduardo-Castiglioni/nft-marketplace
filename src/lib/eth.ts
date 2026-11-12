/**
 * Aritmética decimal de ETH sem ponto flutuante.
 *
 * Todo valor monetário trafega como `string` decimal (ex.: "1.19") e é
 * convertido para `bigint` em wei (18 casas) apenas para calcular. Isso evita
 * erros clássicos como 0.1 + 0.2 = 0.30000000000000004.
 */

export const ETH_DECIMALS = 18
const SCALE = 10n ** BigInt(ETH_DECIMALS)
const DECIMAL_RE = /^-?\d+(\.\d+)?$/

export type EthString = string

export function isEthString(value: unknown): value is EthString {
  return typeof value === 'string' && DECIMAL_RE.test(value.trim())
}

/** "1.19" -> 1190000000000000000n */
export function toWei(value: EthString): bigint {
  const raw = value.trim()
  if (!DECIMAL_RE.test(raw)) throw new Error(`Valor ETH inválido: "${value}"`)
  const negative = raw.startsWith('-')
  const [intPart, fracPart = ''] = raw.replace('-', '').split('.')
  if (fracPart.length > ETH_DECIMALS) throw new Error(`Precisão maior que ${ETH_DECIMALS} casas: "${value}"`)
  const wei = BigInt(intPart) * SCALE + BigInt(fracPart.padEnd(ETH_DECIMALS, '0'))
  return negative ? -wei : wei
}

/** 1190000000000000000n -> "1.19" (sem zeros à direita) */
export function fromWei(wei: bigint): EthString {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const intPart = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(ETH_DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${intPart}${frac ? `.${frac}` : ''}`
}

export const add = (...values: EthString[]): EthString =>
  fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))

export const sub = (a: EthString, b: EthString): EthString => fromWei(toWei(a) - toWei(b))

export const mulInt = (a: EthString, n: number): EthString => {
  if (!Number.isInteger(n)) throw new Error('Multiplicador precisa ser inteiro')
  return fromWei(toWei(a) * BigInt(n))
}

/** Multiplica por percentual em pontos-base (1000 = 10%), arredondando para baixo. */
export const percentOf = (a: EthString, basisPoints: number): EthString =>
  fromWei((toWei(a) * BigInt(basisPoints)) / 10_000n)

export const compare = (a: EthString, b: EthString): -1 | 0 | 1 => {
  const diff = toWei(a) - toWei(b)
  return diff === 0n ? 0 : diff > 0n ? 1 : -1
}

export const eq = (a: EthString, b: EthString) => compare(a, b) === 0
export const gt = (a: EthString, b: EthString) => compare(a, b) === 1
export const lt = (a: EthString, b: EthString) => compare(a, b) === -1
export const max = (a: EthString, b: EthString) => (gt(a, b) ? a : b)
export const isZero = (a: EthString) => toWei(a) === 0n

/**
 * Formata para exibição com no mínimo `minDecimals` casas (padrão 2) e no
 * máximo `maxDecimals` (padrão 3), arredondando meio para cima.
 */
export function formatEth(value: EthString, { minDecimals = 2, maxDecimals = 3, symbol = true } = {}): string {
  let wei = toWei(value)
  const negative = wei < 0n
  if (negative) wei = -wei
  const unit = 10n ** BigInt(ETH_DECIMALS - maxDecimals)
  const rounded = ((wei + unit / 2n) / unit) * unit
  const [int, rawFrac = ''] = fromWei(rounded).split('.')
  const frac = rawFrac.padEnd(minDecimals, '0')
  const out = `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
  return symbol ? `${out} ETH` : out
}

/** Converte número de UI (slider) para string sem notação científica. */
export function fromNumber(n: number, decimals = 4): EthString {
  return fromWei(toWei(n.toFixed(decimals)))
}

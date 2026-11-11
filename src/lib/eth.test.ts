import { add, compare, formatEth, fromWei, mulInt, percentOf, sub, toWei, fromNumber, isEthString } from './eth'

describe('eth decimal math', () => {
  it('soma sem erro de ponto flutuante', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(add('0.1', '0.2')).toBe('0.3')
    expect(add('1.19', '1.39', '3.58', '1.98')).toBe('8.14')
  })

  it('converte para wei e volta', () => {
    expect(toWei('1')).toBe(10n ** 18n)
    expect(toWei('0.000000000000000001')).toBe(1n)
    expect(fromWei(1190000000000000000n)).toBe('1.19')
    expect(fromWei(0n)).toBe('0')
    expect(fromWei(-5n * 10n ** 17n)).toBe('-0.5')
  })

  it('multiplica por quantidade inteira', () => {
    expect(mulInt('1.19', 2)).toBe('2.38')
    expect(mulInt('1.39', 6)).toBe('8.34')
    expect(mulInt('1.79', 9)).toBe('16.11')
    expect(() => mulInt('1', 1.5)).toThrow()
  })

  it('reproduz o total do Figma (26.83 + 0.016 = 26.846)', () => {
    const subtotal = add(mulInt('1.19', 2), mulInt('1.39', 6), mulInt('1.79', 9))
    expect(subtotal).toBe('26.83')
    expect(add(subtotal, '0.016')).toBe('26.846')
  })

  it('subtrai, compara e calcula percentual', () => {
    expect(sub('8.92', '0.892')).toBe('8.028')
    expect(percentOf('8.92', 1000)).toBe('0.892')
    expect(compare('1.2', '1.19')).toBe(1)
    expect(compare('1.190', '1.19')).toBe(0)
    expect(compare('0.5', '1')).toBe(-1)
  })

  it('formata para exibição', () => {
    expect(formatEth('1.19')).toBe('1.19 ETH')
    expect(formatEth('8.936')).toBe('8.936 ETH')
    expect(formatEth('2')).toBe('2.00 ETH')
    expect(formatEth('0.0165')).toBe('0.017 ETH')
    expect(formatEth('1.5', { symbol: false })).toBe('1.50')
  })

  it('rejeita entradas inválidas', () => {
    expect(() => toWei('abc')).toThrow()
    expect(() => toWei('1e5')).toThrow()
    expect(() => toWei('0.' + '1'.repeat(19))).toThrow()
    expect(isEthString('1.2')).toBe(true)
    expect(isEthString(1.2)).toBe(false)
  })

  it('converte números de slider sem notação científica', () => {
    expect(fromNumber(0.02)).toBe('0.02')
    expect(fromNumber(12.3)).toBe('12.3')
  })
})

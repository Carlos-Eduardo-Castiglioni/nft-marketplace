import { toggleInCsv, validateCatalogSearch } from './search'

describe('validateCatalogSearch', () => {
  it('normaliza e remove valores padrão', () => {
    expect(validateCatalogSearch({ page: 1, sort: 'recent', tab: 'all', q: '' })).toEqual({})
  })

  it('aceita filtros válidos', () => {
    expect(
      validateCatalogSearch({ collections: 'arte-digital,musica', networks: 'polygon', minPrice: '0.5', maxPrice: 3, page: '2' }),
    ).toEqual({ collections: 'arte-digital,musica', networks: 'polygon', minPrice: 0.5, maxPrice: 3, page: 2 })
  })

  it('ignora valores inválidos sem quebrar', () => {
    expect(validateCatalogSearch({ sort: 'hack', page: -4, minPrice: 'abc', tab: 42 })).toEqual({})
  })

  it('inverte faixa de preço trocada', () => {
    expect(validateCatalogSearch({ minPrice: 5, maxPrice: 1 })).toEqual({ minPrice: 1, maxPrice: 5 })
  })

  it('alterna itens em CSV', () => {
    expect(toggleInCsv(undefined, 'a')).toBe('a')
    expect(toggleInCsv('a', 'b')).toBe('a,b')
    expect(toggleInCsv('a,b', 'a')).toBe('b')
    expect(toggleInCsv('a', 'a')).toBeUndefined()
  })
})

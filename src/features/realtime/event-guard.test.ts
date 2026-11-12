import { EventGuard } from './events'

describe('EventGuard', () => {
  it('descarta duplicatas pelo eventId', () => {
    const g = new EventGuard()
    const e = { eventId: 'evt-1', id: 'nft-a', version: 2 }
    expect(g.accept(e, 'nft')).toBe(true)
    expect(g.accept(e, 'nft')).toBe(false)
  })

  it('descarta eventos antigos e não regride versões', () => {
    const g = new EventGuard()
    expect(g.accept({ eventId: 'a', id: 'x', version: 3 }, 'nft')).toBe(true)
    expect(g.accept({ eventId: 'b', id: 'x', version: 2 }, 'nft')).toBe(false)
    expect(g.accept({ eventId: 'c', id: 'x', version: 4 }, 'nft')).toBe(true)
  })

  it('considera a versão já obtida via REST', () => {
    const g = new EventGuard()
    expect(g.accept({ eventId: 'a', id: 'x', version: 5 }, 'nft', 5)).toBe(false)
    expect(g.accept({ eventId: 'b', id: 'x', version: 6 }, 'nft', 5)).toBe(true)
  })

  it('isola versões por tipo de recurso', () => {
    const g = new EventGuard()
    expect(g.accept({ eventId: 'a', id: 'x', version: 2 }, 'nft')).toBe(true)
    expect(g.accept({ eventId: 'b', id: 'x', version: 2 }, 'order')).toBe(true)
  })
})

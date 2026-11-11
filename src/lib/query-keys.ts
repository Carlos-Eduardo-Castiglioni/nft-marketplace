import type { CatalogSearch } from '@/features/catalog/search'

export const qk = {
  session: ['session'] as const,
  nfts: {
    all: ['nfts'] as const,
    list: (s: CatalogSearch & { pageSize?: number }) => ['nfts', 'list', s] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
    related: (id: string) => ['nfts', 'related', id] as const,
  },
  favorites: ['favorites'] as const,
  cart: ['cart'] as const,
  orders: {
    all: ['orders'] as const,
    detail: (id: string) => ['orders', id] as const,
  },
  profile: ['profile'] as const,
  wallets: ['wallets'] as const,
}

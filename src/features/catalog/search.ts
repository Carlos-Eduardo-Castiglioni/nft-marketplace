import { z } from 'zod'

/**
 * Estado do catálogo na URL. Arrays viram CSV ("arte-digital,musica") para
 * URLs legíveis; todo campo tem `catch` para que URLs inválidas/antigas nunca
 * quebrem a página — o valor inválido apenas cai no padrão.
 */
const csv = z
  .string()
  .optional()
  .catch(undefined)
  .transform((v) => (v ? v.split(',').filter(Boolean).join(',') || undefined : undefined))
  .optional()

export const SORTS = [
  { id: 'recent', label: 'Listados recentemente' },
  { id: 'price-asc', label: 'Menor preço' },
  { id: 'price-desc', label: 'Maior preço' },
  { id: 'name', label: 'Nome (A–Z)' },
] as const

export const TABS = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
] as const

const priceNum = z.coerce.number().min(0).max(1000).optional().catch(undefined)

export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  collections: csv,
  networks: csv,
  minPrice: priceNum,
  maxPrice: priceNum,
  sort: z.enum(['recent', 'price-asc', 'price-desc', 'name']).optional().catch(undefined),
  tab: z.enum(['all', 'new', 'trending']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export function validateCatalogSearch(input: Partial<Record<keyof CatalogSearch, unknown>>): CatalogSearch {
  const clean = catalogSearchSchema.parse(input)
  // Mantém TODAS as chaves (mesmo `undefined`): o TanStack Router mescla a busca
  // validada sobre a busca bruta, então omitir uma chave deixaria o valor
  // inválido original vazar para o componente. `undefined` some da URL.
  if (clean.q === '') clean.q = undefined
  if (clean.minPrice !== undefined && clean.maxPrice !== undefined && clean.minPrice > clean.maxPrice) {
    ;[clean.minPrice, clean.maxPrice] = [clean.maxPrice, clean.minPrice]
  }
  if (clean.page === 1) clean.page = undefined
  if (clean.sort === 'recent') clean.sort = undefined
  if (clean.tab === 'all') clean.tab = undefined
  return clean
}

/** Remove chaves vazias (para comparar / montar query keys estáveis). */
export function compactSearch(s: CatalogSearch): CatalogSearch {
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as CatalogSearch
}

export const toList = (csvValue?: string) => (csvValue ? csvValue.split(',') : [])
export const fromList = (list: string[]) => (list.length ? list.join(',') : undefined)

export function toggleInCsv(csvValue: string | undefined, id: string) {
  const list = toList(csvValue)
  return fromList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
}

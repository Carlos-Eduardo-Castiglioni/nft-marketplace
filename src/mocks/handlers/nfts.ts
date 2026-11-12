import { http, HttpResponse } from 'msw'
import type { NftDetail, NftListResponse, NftSummary } from '@/lib/api-types'
import { compare, fromWei, toWei } from '@/lib/eth'
import { db, persist, type NftRow } from '../db'
import { ART, COLLECTIONS, DESCRIPTION, EDITIONS, LONG_DESCRIPTION, NETWORKS, REVIEWS, editionPrice } from '../fixtures/nfts'
import { apiError, getOwnerId, withScenario } from '../http'

export function toSummary(n: NftRow, ownerId: string | null): NftSummary {
  const collection = COLLECTIONS.find((c) => c.id === n.collection)
  return {
    id: n.id,
    tokenId: n.tokenId,
    name: n.name,
    image: ART[n.art].image,
    thumb: ART[n.art].thumb,
    price: editionPrice(n.basePrice, '1/50'),
    previousPrice: n.previousPrice,
    collection: n.collection,
    collectionLabel: collection?.label ?? n.collection,
    network: n.network,
    rarity: n.rarity,
    listedAt: n.listedAt,
    trendingScore: n.trendingScore,
    isNew: n.isNew,
    favorite: ownerId ? (db.state.favorites[ownerId] ?? []).includes(n.id) : false,
    version: n.version,
  }
}

export function toDetail(n: NftRow, ownerId: string | null): NftDetail {
  const s = toSummary(n, ownerId)
  return {
    ...s,
    description: DESCRIPTION(n),
    longDescription: LONG_DESCRIPTION(n),
    editions: EDITIONS.map((e) => ({
      id: e.id,
      label: e.label,
      price: editionPrice(n.basePrice, e.id),
      stock: n.stock[e.id],
      maxPerOrder: e.maxPerOrder,
    })),
    attributes: n.attributes,
    rating: 4.8,
    reviewsCount: 19,
    reviews: REVIEWS,
    contract: '0x7442…19E8',
    royalties: '5% nas vendas secundárias',
    gallery: [s.image, s.image, s.image, s.image],
    series: n.series,
  }
}

const PAGE_SIZE_DEFAULT = 9

function parseList(url: URL) {
  const csv = (k: string) => (url.searchParams.get(k) ?? '').split(',').filter(Boolean)
  const num = (k: string) => {
    const v = url.searchParams.get(k)
    return v !== null && v !== '' && !Number.isNaN(Number(v)) ? v : undefined
  }
  return {
    q: (url.searchParams.get('q') ?? '').trim().toLowerCase(),
    collections: csv('collections'),
    networks: csv('networks'),
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    sort: url.searchParams.get('sort') ?? 'recent',
    tab: url.searchParams.get('tab') ?? 'all',
    page: Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1),
    pageSize: Math.min(48, Math.max(1, Number(url.searchParams.get('pageSize') ?? PAGE_SIZE_DEFAULT) || PAGE_SIZE_DEFAULT)),
  }
}

export const nftHandlers = [
  http.get(
    '*/api/nfts',
    withScenario('nfts.list', ({ request }) => {
      const url = new URL(request.url)
      const p = parseList(url)
      const ownerId = getOwnerId(request)
      const all = Object.values(db.state.nfts)

      const matchesText = (n: NftRow) => !p.q || n.name.toLowerCase().includes(p.q) || n.series.toLowerCase().includes(p.q)
      const price = (n: NftRow) => editionPrice(n.basePrice, '1/50')
      const matchesPrice = (n: NftRow) =>
        (!p.minPrice || compare(price(n), p.minPrice) >= 0) && (!p.maxPrice || compare(price(n), p.maxPrice) <= 0)
      const matchesTab = (n: NftRow) => (p.tab === 'new' ? n.isNew : p.tab === 'trending' ? n.trendingScore >= 60 : true)
      const matchesCollection = (n: NftRow) => !p.collections.length || p.collections.includes(n.collection)
      const matchesNetwork = (n: NftRow) => !p.networks.length || p.networks.includes(n.network)

      const base = all.filter((n) => matchesText(n) && matchesPrice(n) && matchesTab(n))
      // facetas: cada grupo conta ignorando o próprio filtro (padrão de e-commerce)
      const collections = COLLECTIONS.map((c) => ({
        id: c.id,
        label: c.label,
        count: base.filter((n) => matchesNetwork(n) && n.collection === c.id).length,
      }))
      const networks = NETWORKS.map((c) => ({
        id: c.id,
        label: c.label,
        count: base.filter((n) => matchesCollection(n) && n.network === c.id).length,
      }))

      const filtered = base.filter((n) => matchesCollection(n) && matchesNetwork(n))
      const sorted = [...filtered].sort((a, b) => {
        switch (p.sort) {
          case 'price-asc':
            return compare(price(a), price(b)) || a.name.localeCompare(b.name)
          case 'price-desc':
            return compare(price(b), price(a)) || a.name.localeCompare(b.name)
          case 'name':
            return a.name.localeCompare(b.name)
          default:
            return p.tab === 'trending' ? b.trendingScore - a.trendingScore : b.listedAt.localeCompare(a.listedAt)
        }
      })
      const totalPages = Math.max(1, Math.ceil(sorted.length / p.pageSize))
      const page = Math.min(p.page, totalPages)
      const prices = all.map((n) => toWei(price(n)))
      const body: NftListResponse = {
        items: sorted.slice((page - 1) * p.pageSize, page * p.pageSize).map((n) => toSummary(n, ownerId)),
        page,
        pageSize: p.pageSize,
        total: sorted.length,
        totalPages,
        facets: {
          collections,
          networks,
          priceRange: {
            min: fromWei(prices.reduce((a, b) => (b < a ? b : a))),
            max: fromWei(prices.reduce((a, b) => (b > a ? b : a))),
          },
        },
      }
      return HttpResponse.json(body)
    }),
  ),

  http.get(
    '*/api/nfts/:id',
    withScenario('nfts.detail', ({ request, params }) => {
      const n = db.state.nfts[params.id as string]
      if (!n) return apiError(404, 'NFT_NOT_FOUND', 'NFT não encontrado.')
      return HttpResponse.json(toDetail(n, getOwnerId(request)))
    }),
  ),

  http.get(
    '*/api/nfts/:id/related',
    withScenario('nfts.related', ({ request, params }) => {
      const n = db.state.nfts[params.id as string]
      if (!n) return apiError(404, 'NFT_NOT_FOUND', 'NFT não encontrado.')
      const ownerId = getOwnerId(request)
      const related = Object.values(db.state.nfts)
        .filter((o) => o.id !== n.id && (o.collection === n.collection || o.series === n.series))
        .slice(0, 10)
        .map((o) => toSummary(o, ownerId))
      return HttpResponse.json(related)
    }),
  ),

  http.get(
    '*/api/favorites',
    withScenario('nfts.favorite', ({ request }) => {
      const ownerId = getOwnerId(request)
      const ids = ownerId ? (db.state.favorites[ownerId] ?? []) : []
      return HttpResponse.json(ids.map((id) => db.state.nfts[id]).filter(Boolean).map((n) => toSummary(n, ownerId)))
    }),
  ),

  http.put(
    '*/api/nfts/:id/favorite',
    withScenario('nfts.favorite', async ({ request, params }) => {
      const ownerId = getOwnerId(request)
      if (!ownerId) return apiError(400, 'NO_OWNER', 'Identificação ausente.')
      const id = params.id as string
      if (!db.state.nfts[id]) return apiError(404, 'NFT_NOT_FOUND', 'NFT não encontrado.')
      const { favorite } = (await request.json()) as { favorite: boolean }
      const list = new Set(db.state.favorites[ownerId] ?? [])
      if (favorite) list.add(id)
      else list.delete(id)
      db.state.favorites[ownerId] = [...list]
      persist()
      return HttpResponse.json({ id, favorite })
    }),
  ),
]

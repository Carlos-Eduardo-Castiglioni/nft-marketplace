/**
 * Fixtures determinísticas de NFTs. Usa um PRNG com semente fixa para que
 * todo carregamento (e todo teste E2E) veja exatamente os mesmos dados.
 */
import type { EditionId, NetworkId } from '@/lib/api-types'
import { fromWei, toWei, type EthString } from '@/lib/eth'

export interface NftRecord {
  id: string
  tokenId: string
  name: string
  art: ArtKey
  basePrice: EthString
  previousPrice?: EthString
  collection: string
  series: string
  network: NetworkId
  rarity?: 'raro' | 'lendario'
  listedAt: string
  trendingScore: number
  isNew: boolean
  attributes: string[]
  stock: Record<EditionId, number>
}

export type ArtKey = 'emerald' | 'nomad' | 'baron' | 'golden'

export const COLLECTIONS = [
  { id: 'arte-digital', label: 'Arte digital' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'musica', label: 'Música' },
  { id: 'arte-3d', label: 'Arte 3D' },
  { id: 'colecionaveis', label: 'Colecionáveis' },
  { id: 'generativa', label: 'Generativa' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'utilidade', label: 'Utilidade' },
] as const

export const NETWORKS: { id: NetworkId; label: string }[] = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'solana', label: 'Solana' },
]

export const EDITIONS: { id: EditionId; label: string; multiplierBps: number; maxPerOrder: number }[] = [
  { id: '1/1', label: '1/1', multiplierBps: 25_000, maxPerOrder: 1 },
  { id: '1/10', label: '1/10', multiplierBps: 15_000, maxPerOrder: 3 },
  { id: '1/50', label: '1/50', multiplierBps: 10_000, maxPerOrder: 10 },
  { id: 'open', label: 'ABERTA', multiplierBps: 5_000, maxPerOrder: 25 },
]

export function editionPrice(basePrice: EthString, editionId: EditionId): EthString {
  const ed = EDITIONS.find((e) => e.id === editionId)!
  // arredonda para 3 casas para manter preços "humanos"
  const wei = (toWei(basePrice) * BigInt(ed.multiplierBps)) / 10_000n
  const unit = 10n ** 15n
  return fromWei((wei / unit) * unit)
}

export const ART: Record<ArtKey, { image: string; thumb: string }> = {
  emerald: { image: 'nfts/emerald-640.webp', thumb: 'nfts/emerald-320.webp' },
  nomad: { image: 'nfts/nomad-640.webp', thumb: 'nfts/nomad-320.webp' },
  baron: { image: 'nfts/baron-640.webp', thumb: 'nfts/baron-320.webp' },
  golden: { image: 'nfts/golden-640.webp', thumb: 'nfts/golden-320.webp' },
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY = 86_400_000
const BASE_DATE = Date.UTC(2026, 10, 1)

type Seed = Omit<NftRecord, 'id' | 'listedAt' | 'trendingScore' | 'isNew' | 'stock' | 'series' | 'attributes'> &
  Partial<Pick<NftRecord, 'attributes' | 'stock'>>

/** NFTs que aparecem nas telas do Figma, com os mesmos nomes e preços. */
const FIGMA_SEEDS: Seed[] = [
  { tokenId: '0042', name: 'Emerald Ape #042', art: 'emerald', basePrice: '1.19', collection: 'arte-digital', network: 'ethereum', attributes: ['Óculos', 'Esmeralda', 'Raro'] },
  { tokenId: '0009', name: 'Sage Nomad #009', art: 'nomad', basePrice: '1.69', collection: 'arte-digital', network: 'ethereum' },
  { tokenId: '0552', name: 'Neon Vessel #552', art: 'emerald', basePrice: '1.99', previousPrice: '2.29', rarity: 'raro', collection: 'colecionaveis', network: 'polygon' },
  { tokenId: '0118', name: 'Cosmic Bloom #118', art: 'nomad', basePrice: '1.29', collection: 'arte-digital', network: 'ethereum' },
  { tokenId: '0314', name: 'Violet Nomad #314', art: 'nomad', basePrice: '1.39', collection: 'arte-digital', network: 'ethereum' },
  { tokenId: '0088', name: 'Ivory Baron #088', art: 'baron', basePrice: '1.79', rarity: 'raro', collection: 'arte-digital', network: 'ethereum' },
  { tokenId: '0207', name: 'Golden Beat #207', art: 'golden', basePrice: '0.99', collection: 'musica', network: 'polygon' },
  { tokenId: '0071', name: 'Golden Frequency #071', art: 'nomad', basePrice: '0.59', collection: 'musica', network: 'solana' },
  { tokenId: '0160', name: 'Golden Signal #160', art: 'golden', basePrice: '0.39', collection: 'musica', network: 'solana' },
  // Itens para validar precisão decimal (0.1 + 0.2 = 0.3)
  { tokenId: '0001', name: 'Decimal Drop #001', art: 'baron', basePrice: '0.1', collection: 'utilidade', network: 'ethereum' },
  { tokenId: '0002', name: 'Decimal Drop #002', art: 'golden', basePrice: '0.2', collection: 'utilidade', network: 'ethereum' },
  // Item com estoque quase esgotado para testar limites de quantidade
  { tokenId: '0777', name: 'Last Light #777', art: 'emerald', basePrice: '3.33', collection: 'fotografia', network: 'ethereum', stock: { '1/1': 0, '1/10': 1, '1/50': 2, open: 3 } },
]

const ADJ = ['Amber', 'Velvet', 'Lunar', 'Copper', 'Silent', 'Crimson', 'Jade', 'Obsidian', 'Solar', 'Misty', 'Royal', 'Rusty', 'Electric', 'Quiet', 'Wild', 'Noble']
const NOUN = ['Ape', 'Nomad', 'Baron', 'Echo', 'Pilot', 'Monk', 'Drifter', 'Sentinel', 'Dreamer', 'Rider', 'Scholar', 'Wanderer']
const ATTRS = ['Óculos', 'Chapéu', 'Fones', 'Jaqueta', 'Moletom', 'Gola alta', 'Esmeralda', 'Ouro', 'Raro', 'Comum', 'Animado', 'Estático']
const ARTS: ArtKey[] = ['emerald', 'nomad', 'baron', 'golden']

function buildCatalog(): NftRecord[] {
  const rand = mulberry32(20261111)
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]
  const seeds: Seed[] = [...FIGMA_SEEDS]

  // Distribuição determinística para os filtros terem contagens interessantes
  const collectionWeights = [33, 12, 65, 39, 23, 17, 19, 13, 18]
  const totalWeight = collectionWeights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < 60; i++) {
    let r = rand() * totalWeight
    let ci = 0
    while (r > collectionWeights[ci]) r -= collectionWeights[ci++]
    const tokenNum = 100 + Math.floor(rand() * 899)
    const priceCents = 2 + Math.floor(rand() * rand() * 1228) // 0.02 – 12.30, enviesado para baixo
    const net = rand()
    seeds.push({
      tokenId: String(tokenNum).padStart(4, '0'),
      name: `${pick(ADJ)} ${pick(NOUN)} #${String(tokenNum).padStart(3, '0')}`,
      art: pick(ARTS),
      basePrice: fromWei(BigInt(priceCents) * 10n ** 16n),
      rarity: rand() > 0.85 ? 'raro' : undefined,
      collection: COLLECTIONS[ci].id,
      network: net < 0.45 ? 'ethereum' : net < 0.75 ? 'polygon' : 'solana',
    })
  }

  const used = new Set<string>()
  return seeds.map((s, i) => {
    const r1 = rand()
    let id = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    if (used.has(id)) id = `${id}-${i}`
    used.add(id)
    return {
      ...s,
      id,
      series: s.art === 'golden' ? 'Kurio Beats' : 'Kurio Apes',
      listedAt: new Date(BASE_DATE - i * DAY * 0.7).toISOString(),
      trendingScore: Math.round((1 - i / seeds.length) * 40 + r1 * 60),
      isNew: i % 3 === 0,
      attributes: s.attributes ?? [pick(ATTRS), pick(ATTRS), s.rarity === 'raro' ? 'Raro' : 'Comum'],
      stock: s.stock ?? { '1/1': 1, '1/10': 10, '1/50': 50, open: 999 },
    }
  })
}

export const NFT_FIXTURES: NftRecord[] = buildCatalog()

export const DESCRIPTION = (n: Pick<NftRecord, 'name' | 'series'>) =>
  `Um colecionável digital finalizado à mão da coleção ${n.series === 'Kurio Beats' ? 'Kurio Beats' : 'Kurio Editions'}, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.`

export const LONG_DESCRIPTION = (n: Pick<NftRecord, 'name'>) => [
  `${n.name} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
  'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Seto recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
]

export const REVIEWS = [
  { id: 'r1', author: 'nova.kurio.eth', rating: 5, text: 'Acabamento impecável, a versão em alta resolução é incrível.' },
  { id: 'r2', author: '0x7a3…91be', rating: 5, text: 'Entrega instantânea na carteira e procedência clara.' },
  { id: 'r3', author: 'colecionador.eth', rating: 4, text: 'Ótima peça, gostaria de mais variações de edição.' },
]

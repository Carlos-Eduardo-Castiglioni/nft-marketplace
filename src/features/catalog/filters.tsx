import { useState } from 'react'
import type { NftListResponse } from '@/lib/api-types'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { toList, toggleInCsv, type CatalogSearch } from './search'

type Facets = NftListResponse['facets']

interface Props {
  search: CatalogSearch
  facets?: Facets
  onChange: (patch: Partial<CatalogSearch>) => void
  idPrefix?: string
  className?: string
}

const DEFAULT_RANGE: [number, number] = [0.02, 12.3]

/**
 * Filtros do catálogo. Toda alteração vai direto para a URL (search params),
 * exceto a faixa de preço que aplica no botão "Aplicar" (como no Figma).
 */
export function CatalogFilters({ search, facets, onChange, idPrefix = 'f', className }: Props) {
  const bounds: [number, number] = facets
    ? [Math.floor(Number(facets.priceRange.min) * 100) / 100, Math.ceil(Number(facets.priceRange.max) * 100) / 100]
    : DEFAULT_RANGE
  const urlRange: [number, number] = [search.minPrice ?? bounds[0], search.maxPrice ?? bounds[1]]
  const [range, setRange] = useState<[number, number]>(urlRange)

  // URL é a fonte da verdade: ressincroniza durante o render quando ela muda
  // (voltar/avançar, limpar) — sem efeito, sem render extra em cascata.
  const urlKey = `${urlRange[0]}|${urlRange[1]}`
  const [syncedKey, setSyncedKey] = useState(urlKey)
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey)
    setRange(urlRange)
  }

  const selectedCollections = toList(search.collections)
  const selectedNetworks = toList(search.networks)
  const hasFilters = !!(search.collections || search.networks || search.minPrice !== undefined || search.maxPrice !== undefined || search.q)
  const fmt = (n: number) => n.toFixed(2).replace('.', ',')

  return (
    <div className={cn('space-y-6 font-mono', className)}>
      <FacetGroup
        title="Coleções"
        idPrefix={`${idPrefix}-col`}
        facets={facets?.collections}
        selected={selectedCollections}
        onToggle={(id) => onChange({ collections: toggleInCsv(search.collections, id), page: undefined })}
      />

      <fieldset>
        <legend className="mb-3 text-xs font-bold">Faixa de preço</legend>
        <Slider
          min={bounds[0]}
          max={bounds[1]}
          step={0.01}
          minStepsBetweenThumbs={1}
          value={range}
          onValueChange={(v) => setRange([v[0], v[1]])}
          thumbLabels={['Preço mínimo', 'Preço máximo']}
        />
        <p className="mt-2 text-[11px] text-foreground" aria-live="polite">
          Preço: {fmt(range[0])} - {fmt(range[1])} ETH
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="rounded bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary-strong"
            onClick={() =>
              onChange({
                minPrice: range[0] <= bounds[0] ? undefined : range[0],
                maxPrice: range[1] >= bounds[1] ? undefined : range[1],
                page: undefined,
              })
            }
          >
            Aplicar
          </button>
          {hasFilters && (
            <button
              type="button"
              className="rounded px-2 py-1 text-[11px] text-muted underline-offset-2 hover:text-primary hover:underline"
              onClick={() =>
                onChange({ collections: undefined, networks: undefined, minPrice: undefined, maxPrice: undefined, q: undefined, page: undefined })
              }
            >
              Limpar filtros
            </button>
          )}
        </div>
      </fieldset>

      <FacetGroup
        title="Rede"
        idPrefix={`${idPrefix}-net`}
        facets={facets?.networks}
        selected={selectedNetworks}
        onToggle={(id) => onChange({ networks: toggleInCsv(search.networks, id), page: undefined })}
      />
    </div>
  )
}

function FacetGroup({
  title,
  facets,
  selected,
  onToggle,
  idPrefix,
}: {
  title: string
  facets?: { id: string; label: string; count: number }[]
  selected: string[]
  onToggle: (id: string) => void
  idPrefix: string
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-xs font-bold">{title}</legend>
      <ul className="space-y-2.5">
        {facets
          ? facets.map((f) => {
              const id = `${idPrefix}-${f.id}`
              const checked = selected.includes(f.id)
              return (
                <li key={f.id} className="flex items-center gap-2">
                  <Checkbox id={id} checked={checked} onCheckedChange={() => onToggle(f.id)} />
                  <label
                    htmlFor={id}
                    className={cn('flex flex-1 cursor-pointer justify-between text-[11px] transition-colors hover:text-primary', checked ? 'text-primary' : 'text-muted')}
                  >
                    <span>{f.label}</span>
                    <span className="tabular" aria-label={`${f.count} itens`}>
                      ({f.count})
                    </span>
                  </label>
                </li>
              )
            })
          : Array.from({ length: title === 'Rede' ? 3 : 9 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-4 w-full" />
              </li>
            ))}
      </ul>
    </fieldset>
  )
}

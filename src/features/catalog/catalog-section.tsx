import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { Dialog, DialogTitle, DialogTrigger, SheetContent, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNftList, PAGE_SIZE } from './api'
import { CatalogFilters } from './filters'
import { NftCard, NftCardSkeleton } from './nft-card'
import { SORTS, TABS, type CatalogSearch } from './search'
import { FeaturedNft } from './featured-nft'

type RouteId = '/' | '/market'

export function CatalogSection({ routeId, showFeatured = true }: { routeId: RouteId; showFeatured?: boolean }) {
  const search = useSearch({ from: routeId })
  const navigate = useNavigate({ from: routeId })
  const query = useNftList(search)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const update = (patch: Partial<CatalogSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), resetScroll: false, replace: false })

  const data = query.data
  const activeCount =
    (search.collections?.split(',').length ?? 0) +
    (search.networks?.split(',').length ?? 0) +
    (search.minPrice !== undefined || search.maxPrice !== undefined ? 1 : 0)

  return (
    <section id="catalogo" aria-labelledby="catalog-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 sm:px-6">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>

      {/* Busca + filtros (mobile, como no Figma) */}
      <div className="mb-4 flex gap-3 md:hidden">
        <SearchBox value={search.q} onSubmit={(q) => update({ q, page: undefined })} />
        <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DialogTrigger
            className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-copper text-primary-foreground"
            aria-label={`Abrir filtros${activeCount ? ` (${activeCount} ativos)` : ''}`}
          >
            <SlidersHorizontal className="size-5" />
            {activeCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-foreground font-mono text-[10px] font-bold text-background">
                {activeCount}
              </span>
            )}
          </DialogTrigger>
          <SheetContent side="left" aria-describedby="filters-desc">
            <DialogTitle className="mb-1">Filtros</DialogTitle>
            <DialogDescription id="filters-desc" className="mb-6">
              Os resultados atualizam automaticamente.
            </DialogDescription>
            <CatalogFilters search={search} facets={data?.facets} onChange={update} idPrefix="m" />
            <Button className="mt-8 w-full" onClick={() => setDrawerOpen(false)}>
              Ver {data?.total ?? ''} resultados
            </Button>
          </SheetContent>
        </Dialog>
      </div>

      <div className="grid gap-8 md:grid-cols-[13.5rem_1fr]">
        <aside aria-label="Filtros" className="hidden md:block">
          <div className="rounded-sm bg-surface p-4">
            <CatalogFilters search={search} facets={data?.facets} onChange={update} idPrefix="d" />
          </div>
          {showFeatured && <FeaturedNft />}
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div role="tablist" aria-label="Seções do catálogo" className="flex gap-5 font-mono text-xs">
              {TABS.map((t) => {
                const active = (search.tab ?? 'all') === t.id
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    aria-controls="catalog-grid"
                    onClick={() => update({ tab: t.id === 'all' ? undefined : t.id, page: undefined })}
                    className={cn(
                      'border-b-2 pb-1 font-semibold transition-colors',
                      active ? 'border-primary text-primary' : 'border-transparent text-foreground hover:text-primary',
                    )}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span id="sort-label" className="hidden sm:inline">
                Ordenar por:
              </span>
              <Select value={search.sort ?? 'recent'} onValueChange={(v) => update({ sort: v as CatalogSearch['sort'], page: undefined })}>
                <SelectTrigger aria-labelledby="sort-label" aria-label="Ordenar por" className="h-8 w-auto gap-2 border-0 bg-transparent px-1 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="hidden md:mb-4 md:block">
            {search.q && (
              <p className="font-mono text-xs text-muted">
                Resultados para “<span className="text-foreground">{search.q}</span>”{' '}
                <button className="ml-2 text-primary hover:underline" onClick={() => update({ q: undefined, page: undefined })}>
                  limpar
                </button>
              </p>
            )}
          </div>

          {query.isError && !data ? (
            <Alert
              variant="error"
              title="Não foi possível carregar os NFTs"
              action={
                <Button size="sm" onClick={() => query.refetch()} loading={query.isFetching}>
                  Tentar novamente
                </Button>
              }
            >
              {query.error.message}
            </Alert>
          ) : (
            <>
              <p className="sr-only" aria-live="polite">
                {data ? `${data.total} NFTs encontrados` : 'Carregando NFTs'}
              </p>
              <div
                id="catalog-grid"
                role="tabpanel"
                aria-busy={query.isFetching}
                data-testid="catalog-grid"
                className={cn('grid grid-cols-2 gap-x-4 gap-y-6 transition-opacity sm:grid-cols-3', query.isPlaceholderData && 'opacity-60')}
              >
                {data
                  ? data.items.map((n, i) => <NftCard key={n.id} nft={n} priority={i < 3} />)
                  : Array.from({ length: PAGE_SIZE }, (_, i) => <NftCardSkeleton key={i} />)}
              </div>
              {data && data.items.length === 0 && (
                <div className="rounded-xl bg-surface p-10 text-center font-mono text-sm text-muted">
                  Nenhum NFT encontrado com esses filtros.
                </div>
              )}
              {data && data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} onPage={(page) => update({ page: page === 1 ? undefined : page })} />}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function SearchBox({ value, onSubmit }: { value?: string; onSubmit: (q: string | undefined) => void }) {
  const [q, setQ] = useState(value ?? '')
  return (
    <form
      role="search"
      className="relative flex-1"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(q.trim() || undefined)
      }}
    >
      <label htmlFor="catalog-search" className="sr-only">
        Explorar coleções
      </label>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id="catalog-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Explorar coleções"
        className="h-12 w-full rounded-xl bg-surface-2 pl-11 pr-4 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      />
    </form>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1 || (page <= 2 && p <= 4),
  )
  const btn = 'flex size-6 items-center justify-center rounded-sm font-mono text-[11px] transition-colors'
  return (
    <nav aria-label="Paginação" className="mt-8 flex justify-end">
      <ul className="flex items-center gap-1.5">
        <li>
          <button className={cn(btn, 'hover:text-primary disabled:opacity-30')} disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
            <ChevronLeft className="size-3.5" />
          </button>
        </li>
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-1.5">
            {i > 0 && p - pages[i - 1] > 1 && <span aria-hidden className="text-subtle">…</span>}
            <button
              className={cn(btn, p === page ? 'bg-primary font-bold text-primary-foreground' : 'text-foreground hover:text-primary')}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          </li>
        ))}
        <li>
          <button className={cn(btn, 'hover:text-primary disabled:opacity-30')} disabled={page === totalPages} onClick={() => onPage(page + 1)} aria-label="Próxima página">
            <ChevronRight className="size-3.5" />
          </button>
        </li>
      </ul>
    </nav>
  )
}

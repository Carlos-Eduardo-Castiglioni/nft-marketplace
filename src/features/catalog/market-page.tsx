import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { CatalogSection } from './catalog-section'

export function MarketPage() {
  return (
    <div className="pt-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado' }]} />
        <h1 className="mb-6 font-mono text-lg font-bold">Mercado</h1>
      </div>
      <CatalogSection routeId="/market" showFeatured={false} />
    </div>
  )
}

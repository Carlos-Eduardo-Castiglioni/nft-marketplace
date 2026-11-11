import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Hero } from './hero'
import { CatalogSection } from './catalog-section'

const POSTS = [
  { date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', img: 'nfts/baron-320.webp' },
  { date: '13 de setembro', read: '3 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', img: 'nfts/emerald-320.webp' },
  { date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', img: 'nfts/nomad-320.webp' },
  { date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', img: 'nfts/golden-320.webp' },
]

export function HomePage() {
  return (
    <>
      <Hero />
      <CatalogSection routeId="/" />

      <section aria-label="Lançamentos" className="mx-auto mt-16 grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-2">
        {[
          { img: 'nfts/emerald-320.webp', title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.' },
          { img: 'nfts/baron-320.webp', title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.' },
        ].map((b) => (
          <article key={b.title} className="grid grid-cols-[9rem_1fr] items-center gap-4 bg-surface sm:grid-cols-[11rem_1fr]">
            <img src={b.img} alt="" width={320} height={320} loading="lazy" className="aspect-square w-full object-cover" />
            <div className="p-4 text-center font-mono">
              <h3 className="text-xs font-bold">{b.title}</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{b.text}</p>
              <Link to="/market" className="mt-3 inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary-strong">
                Explorar <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="blog-title" className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <h2 id="blog-title" className="text-center font-mono text-base font-bold">
          Diário da Cunhagem
        </h2>
        <p className="mt-2 text-center font-mono text-[11px] text-muted">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {POSTS.map((p) => (
            <article key={p.title} className="bg-surface font-mono">
              <img src={p.img} alt="" width={320} height={320} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <div className="p-3">
                <p className="text-[10px] text-primary">
                  {p.date} | Leitura de {p.read}
                </p>
                <h3 className="mt-2 text-xs font-bold">{p.title}</h3>
                <p className="mt-1 text-[11px] text-muted">{p.text}</p>
                <Link to="/learn" className="mt-2 inline-block text-[11px] text-primary hover:underline" aria-label={`Ler mais: ${p.title}`}>
                  Ler mais →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

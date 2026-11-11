import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const SLIDES = [
  { title: ['SEJA DONO DO FUTURO', 'DA ARTE DIGITAL'], image: 'nfts/emerald-640.webp', alt: 'Emerald Ape #042' },
  { title: ['COLECIONE EDIÇÕES', 'GÊNESIS LIMITADAS'], image: 'nfts/baron-640.webp', alt: 'Ivory Baron #088' },
  { title: ['APOIE ARTISTAS', 'DA NOVA CULTURA'], image: 'nfts/golden-640.webp', alt: 'Golden Beat #207' },
]

export function Hero() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  return (
    <section aria-roledescription="carrossel" aria-label="Destaques" className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 md:pt-8">
      <div className="relative grid items-center gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#6b4429] via-[#4a2f1e] to-[#2d1d14] p-5 md:grid-cols-[1fr_auto] md:rounded-none md:bg-none md:p-0">
        <div className="relative z-10 md:pl-4">
          <p className="mb-2 font-mono text-[11px] font-semibold">Bem-vindo à Kurio</p>
          <h1 className="font-mono text-lg font-bold leading-relaxed tracking-wide sm:text-2xl md:text-[1.7rem] md:leading-[1.6]">
            {slide.title[0]}
            <br />
            {slide.title[1]}
          </h1>
          <p className="mt-3 max-w-md font-mono text-[11px] leading-relaxed text-muted">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <a
            href="#catalogo"
            className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] font-bold text-primary md:h-8 md:rounded md:bg-primary md:px-5 md:text-primary-foreground md:hover:bg-primary-strong"
          >
            EXPLORAR <ArrowRight className="size-3.5 md:hidden" aria-hidden />
          </a>
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[17rem] md:mr-0 md:w-80 md:max-w-none">
          <img
            src={slide.image}
            alt={slide.alt}
            width={640}
            height={640}
            fetchPriority="high"
            className="aspect-square w-full rounded-2xl object-cover"
          />
        </div>
        <div className="z-10 flex justify-center gap-2 md:absolute md:bottom-6 md:left-1/2 md:-translate-x-1/2" role="group" aria-label="Escolher destaque">
          {SLIDES.map((s, i) => (
            <button
              key={s.alt}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Destaque ${i + 1}: ${s.alt}`}
              aria-current={i === index}
              className={cn('size-2 rounded-full transition-colors', i === index ? 'bg-primary' : 'bg-primary/35 hover:bg-primary/70')}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

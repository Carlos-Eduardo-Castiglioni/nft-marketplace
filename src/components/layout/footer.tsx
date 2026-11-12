import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { z } from 'zod'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const COLUMNS = [
  { title: 'Meu perfil', links: ['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse'] },
  { title: 'Central de ajuda', links: ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'] },
  { title: 'Coleções', links: ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'] },
]

const emailSchema = z.string().email()

export function Footer() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <footer className="mx-auto mt-16 max-w-6xl px-4 pb-24 sm:px-6 md:pb-8">
      <div className="grid gap-px overflow-hidden bg-surface md:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="border-border bg-surface p-6 md:border-r">
            <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground" aria-hidden>
              {f.letter}
            </span>
            <h3 className="mb-2 font-mono text-xs font-bold">{f.title}</h3>
            <p className="text-xs leading-relaxed text-muted">{f.text}</p>
          </div>
        ))}
        <form
          className="bg-surface p-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (!emailSchema.safeParse(email).success) return setError('Informe um e-mail válido.')
            setError(null)
            // Newsletter está fora do escopo da entrega: não simulamos uma inscrição bem-sucedida.
            toast.info('Newsletter indisponível nesta demonstração.', {
              description: 'Nenhuma inscrição foi realizada.',
            })
          }}
        >
          <h3 className="mb-3 font-mono text-xs font-bold">Antecipe-se ao próximo lançamento</h3>
          <div className="flex">
            <label htmlFor="newsletter" className="sr-only">
              Seu e-mail
            </label>
            <input
              id="newsletter"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="digite seu e-mail..."
              aria-invalid={!!error}
              aria-describedby={error ? 'newsletter-error' : undefined}
              className="h-8 min-w-0 flex-1 rounded-l bg-surface-2 px-3 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
            <button type="submit" className="h-8 rounded-r bg-primary px-3 font-mono text-[11px] font-bold text-primary-foreground hover:bg-primary-strong">
              Enviar
            </button>
          </div>
          {error && (
            <p id="newsletter-error" role="alert" className="mt-1 text-[11px] text-destructive">
              {error}
            </p>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
          </p>
        </form>
      </div>

      <div className="grid gap-4 bg-band px-6 py-5 font-mono text-[11px] sm:grid-cols-4 sm:items-center">
        <span className="font-bold tracking-[0.2em]">KURIO</span>
        <span className="text-foreground/80">Feito para colecionadores, criadores e cultura</span>
        <a href="mailto:contato@email.com" className="hover:text-primary">
          contato@email.com
        </a>
        <span>+55 11 4002 8922</span>
      </div>

      <div className="grid gap-8 bg-surface px-6 py-8 sm:grid-cols-2 md:grid-cols-4">
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h3 className="mb-3 font-mono text-xs font-bold">{c.title}</h3>
            <ul className="space-y-1.5">
              {c.links.map((l) => (
                <li key={l}>
                  <Link to={c.title === 'Meu perfil' ? '/profile' : '/market'} className="text-[11px] text-foreground/80 hover:text-primary">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div>
          <h3 className="mb-3 font-mono text-xs font-bold">Redes sociais</h3>
          <ul className="flex gap-2" aria-label="Redes sociais">
            {['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube'].map((s) => (
              <li key={s}>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  aria-label={s}
                  className="flex size-6 items-center justify-center rounded border border-primary/70 font-mono text-[10px] text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  {s[0]}
                </a>
              </li>
            ))}
          </ul>
          <h3 className="mb-2 mt-6 font-mono text-xs font-bold">Carteiras compatíveis</h3>
          <p className="inline-block rounded bg-primary/15 px-2 py-1 font-mono text-[9px] tracking-wider text-primary">
            METAMASK • WALLETCONNECT • COINBASE
          </p>
        </div>
      </div>
      <p className="pt-4 text-center font-mono text-[10px] text-muted">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

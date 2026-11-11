import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

function StatusShell({ code, title, children }: { code: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="font-mono text-6xl font-bold text-primary">{code}</p>
      <h1 className="mt-4 font-mono text-lg font-bold">{title}</h1>
      <div className="mt-6 flex flex-col items-center gap-4 text-sm text-muted">{children}</div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <StatusShell code="404" title="Página não encontrada">
      <p>O conteúdo que você procura não existe ou foi removido.</p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </StatusShell>
  )
}

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <StatusShell code="Ops" title="Algo deu errado">
      <p>{error instanceof Error ? error.message : 'Erro inesperado.'}</p>
      <Button
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        Tentar novamente
      </Button>
    </StatusShell>
  )
}

export function CreatorsPage() {
  return (
    <StatusShell code="Em breve" title="Criadores em destaque">
      <p>Estamos selecionando artistas, estúdios e comunidades que moldam a cultura digital.</p>
      <Button asChild variant="outline-primary">
        <Link to="/market">Explorar o mercado</Link>
      </Button>
    </StatusShell>
  )
}

export function LearnPage() {
  return (
    <StatusShell code="Em breve" title="Diário da Cunhagem">
      <p>Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <Button asChild variant="outline-primary">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </StatusShell>
  )
}

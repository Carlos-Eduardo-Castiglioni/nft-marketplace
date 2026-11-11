import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { LoginForm, RegisterForm } from './auth-forms'

function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-center px-4 py-10 sm:py-16">
      <section className="w-full max-w-md rounded-3xl bg-surface px-6 py-12 sm:px-10" aria-labelledby="auth-title">
        <p className="mb-14 text-center font-mono text-3xl font-bold tracking-[0.3em] text-foreground">KURIO</p>
        <h1 id="auth-title" className="mb-8 text-center font-mono text-base font-bold">
          {title}
        </h1>
        {children}
      </section>
    </div>
  )
}

export function LoginPage() {
  const search = useSearch({ from: '/login' })
  const navigate = useNavigate()
  return (
    <AuthCard title="Entrar">
      <LoginForm
        onSuccess={() => navigate({ to: search.redirect ?? '/', replace: true })}
        footer={
          <p className="pt-6 text-center font-mono text-sm text-muted">
            Novo na Kurio?{' '}
            <Link to="/register" search={{ redirect: search.redirect }} className="text-muted underline-offset-4 hover:text-primary hover:underline">
              Crie uma conta
            </Link>
          </p>
        }
      />
    </AuthCard>
  )
}

export function RegisterPage() {
  const search = useSearch({ from: '/register' })
  const navigate = useNavigate()
  return (
    <AuthCard title="Criar perfil de colecionador">
      <RegisterForm
        onSuccess={() => navigate({ to: search.redirect ?? '/profile', replace: true })}
        footer={
          <p className="pt-6 text-center font-mono text-sm text-muted">
            Já tem uma conta?{' '}
            <Link to="/login" search={{ redirect: search.redirect }} className="text-muted underline-offset-4 hover:text-primary hover:underline">
              Entre
            </Link>
          </p>
        }
      />
    </AuthCard>
  )
}

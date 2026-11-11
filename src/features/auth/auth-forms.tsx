import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { ApiError } from '@/lib/http'
import { useLogin, useOAuthLogin, useRegister } from './api'
import { loginSchema, registerSchema, type LoginValues, type RegisterValues } from './schemas'

interface FormProps {
  onSuccess?: () => void
  compact?: boolean
  footer?: React.ReactNode
}

export function SocialButtons({ compact }: { compact?: boolean }) {
  const oauth = useOAuthLogin()
  const btn = cn(
    'flex w-full items-center justify-center gap-3 rounded-md border border-border font-mono text-xs text-muted transition-colors hover:border-primary hover:text-foreground disabled:opacity-50',
    compact ? 'h-9' : 'h-12',
  )
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 font-mono text-[11px] text-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        Ou continue com
        <span className="h-px flex-1 bg-border" />
      </div>
      <button type="button" className={btn} disabled={oauth.isPending} onClick={() => oauth.mutate('google')}>
        <GoogleIcon /> Continuar com Google
      </button>
      <button type="button" className={btn} disabled={oauth.isPending} onClick={() => oauth.mutate('facebook')}>
        <FacebookIcon /> Continuar com Facebook
      </button>
    </div>
  )
}

function ServerError({ error }: { error: ApiError | null }) {
  if (!error || error.field) return null
  return <Alert variant="error" title={error.message} />
}

export function LoginForm({ onSuccess, compact, footer }: FormProps) {
  const login = useLogin()
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: (s) => {
        toast.success(`Bem-vindo de volta, ${s.user.displayName}!`)
        onSuccess?.()
      },
      onError: (e) => {
        if (e.code === 'INVALID_CREDENTIALS') form.setError('password', { message: e.message })
      },
    }),
  )

  return (
    <form onSubmit={onSubmit} noValidate className={cn('space-y-4', compact && 'space-y-3')} aria-label="Formulário de login">
      <ServerError error={login.error?.code === 'INVALID_CREDENTIALS' ? null : login.error} />
      <Field label="E-mail" srLabel error={errors.email?.message}>
        <Input type="email" autoComplete="email" placeholder="contato@email.com" className={cn(compact && 'h-9')} {...form.register('email')} />
      </Field>
      <Field label="Senha" srLabel error={errors.password?.message}>
        <PasswordInput autoComplete="current-password" placeholder="Senha" className={cn(compact && 'h-9')} {...form.register('password')} />
      </Field>
      <div className="flex justify-end">
        <button
          type="button"
          className="font-mono text-xs text-primary hover:underline"
          onClick={() => toast.info('Enviamos um link de recuperação para o seu e-mail (simulado).')}
        >
          Esqueceu a senha?
        </button>
      </div>
      <Button type="submit" size={compact ? 'default' : 'lg'} className="w-full" loading={login.isPending}>
        Entrar
      </Button>
      <SocialButtons compact={compact} />
      {footer}
    </form>
  )
}

export function RegisterForm({ onSuccess, compact, footer }: FormProps) {
  const registerMutation = useRegister()
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors } = form.formState
  const h = cn(compact && 'h-9')

  const onSubmit = form.handleSubmit(({ confirmPassword: _c, ...values }) =>
    registerMutation.mutate(values, {
      onSuccess: () => {
        toast.success('Perfil de colecionador criado!')
        onSuccess?.()
      },
      onError: (e) => {
        if (e.field === 'email' || e.field === 'username') form.setError(e.field, { message: e.message })
      },
    }),
  )

  return (
    <form onSubmit={onSubmit} noValidate className={cn('space-y-4', compact && 'space-y-3')} aria-label="Formulário de cadastro">
      <ServerError error={registerMutation.error} />
      <Field label="Nome de usuário" srLabel error={errors.username?.message}>
        <Input autoComplete="username" placeholder="Nome de usuário" className={h} {...form.register('username')} />
      </Field>
      <Field label="E-mail" srLabel error={errors.email?.message}>
        <Input type="email" autoComplete="email" placeholder="Digite seu e-mail" className={h} {...form.register('email')} />
      </Field>
      <Field label="Senha" srLabel error={errors.password?.message}>
        <PasswordInput autoComplete="new-password" placeholder="Senha" className={h} {...form.register('password')} />
      </Field>
      <Field label="Confirmar senha" srLabel error={errors.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" placeholder="Confirmar senha" className={h} {...form.register('confirmPassword')} />
      </Field>
      <Button type="submit" size={compact ? 'default' : 'lg'} className="w-full" loading={registerMutation.isPending}>
        {compact ? 'Criar conta' : 'Criar perfil'}
      </Button>
      <SocialButtons compact={compact} />
      {footer}
    </form>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
      <path fill="#34A853" d="M3.3 7.4l3.2 2.4C7.4 7.9 9.5 6.2 12 6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 8.2 2.2 4.9 4.4 3.3 7.4z" opacity=".9" />
      <path fill="#FBBC05" d="M12 21.8c2.5 0 4.7-.8 6.2-2.3l-3-2.4c-.8.6-1.9 1-3.2 1-2.5 0-4.6-1.7-5.4-4l-3.2 2.5c1.6 3.1 4.9 5.2 8.6 5.2z" opacity=".9" />
      <path fill="#4285F4" d="M21.4 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.2-1 2.2-2.3 3l3 2.4c1.8-1.6 3.2-4.2 3.2-7.7z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4267B2" d="M14 8V6.2c0-.8.2-1.2 1.4-1.2H17V2h-2.6C11.3 2 10.3 3.5 10.3 6v2H8v3h2.3v11H14V11h2.6l.4-3H14z" />
    </svg>
  )
}

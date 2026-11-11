import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { LoginForm, RegisterForm } from './auth-forms'

type Mode = 'login' | 'register'

interface Ctx {
  open: (mode?: Mode, opts?: { onSuccess?: () => void }) => void
  close: () => void
  state: { open: boolean; mode: Mode; onSuccess?: () => void }
  setMode: (m: Mode) => void
}

const AuthDialogContext = createContext<Ctx | null>(null)

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Ctx['state']>({ open: false, mode: 'login' })
  const open = useCallback<Ctx['open']>((mode = 'login', opts) => setState({ open: true, mode, onSuccess: opts?.onSuccess }), [])
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])
  const setMode = useCallback((mode: Mode) => setState((s) => ({ ...s, mode })), [])
  const value = useMemo(() => ({ open, close, state, setMode }), [open, close, state, setMode])
  return <AuthDialogContext.Provider value={value}>{children}</AuthDialogContext.Provider>
}

export function useAuthDialog() {
  const ctx = useContext(AuthDialogContext)
  if (!ctx) throw new Error('useAuthDialog precisa do AuthDialogProvider')
  return ctx
}

/** Modal "Entrar | Criar conta" do header (Figma desktop). */
export function AuthDialog() {
  const { state, close, setMode } = useAuthDialog()
  const done = () => {
    close()
    state.onSuccess?.()
  }
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm">
        <div className="mb-2 flex items-center justify-center gap-2 font-mono text-sm" role="tablist" aria-label="Acesso">
          {(['login', 'register'] as const).map((m, i) => (
            <span key={m} className="flex items-center gap-2">
              {i === 1 && <span className="h-4 w-px bg-primary" aria-hidden />}
              <button
                type="button"
                role="tab"
                aria-selected={state.mode === m}
                onClick={() => setMode(m)}
                className={cn('font-semibold transition-colors', state.mode === m ? 'text-primary' : 'text-foreground hover:text-primary')}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </span>
          ))}
        </div>
        <DialogTitle className="sr-only">{state.mode === 'login' ? 'Entrar na Kurio' : 'Criar conta na Kurio'}</DialogTitle>
        <DialogDescription className="mb-5 text-center text-[11px] leading-relaxed">
          {state.mode === 'login'
            ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
            : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
        </DialogDescription>
        {state.mode === 'login' ? (
          <LoginForm onSuccess={done} compact />
        ) : (
          <RegisterForm onSuccess={done} compact />
        )}
      </DialogContent>
    </Dialog>
  )
}

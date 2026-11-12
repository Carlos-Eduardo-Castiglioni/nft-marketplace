import { useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { toast, Toaster } from 'sonner'
import { onSessionExpired } from '@/lib/http'
import { expireSession } from '@/features/auth/api'
import { createQueryClient } from './query-client'
import { createAppRouter } from './router'
import { RealtimeProvider } from '@/features/realtime/realtime'
import { AuthDialogProvider } from '@/features/auth/auth-dialog'

export function App() {
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(() => createAppRouter(queryClient))

  // Sessão expirada em qualquer requisição: limpa dados privados e, se a tela
  // atual é privada (checkout, perfil, pedido), leva ao login com retorno para ela.
  useEffect(
    () =>
      onSessionExpired(() => {
        expireSession(queryClient)
        toast.warning('Sua sessão expirou. Entre novamente para continuar.', { id: 'session-expired' })
        const { pathname, href } = router.state.location
        if (/^\/(checkout|profile|orders)(\/|$)/.test(pathname)) {
          void router.navigate({ to: '/login', search: { redirect: href }, replace: true })
        }
      }),
    [queryClient, router],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <AuthDialogProvider>
          <RouterProvider router={router} />
        </AuthDialogProvider>
      </RealtimeProvider>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: '!bg-surface-2 !border-border !text-foreground !font-mono !text-xs',
            description: '!text-muted',
          },
        }}
      />
    </QueryClientProvider>
  )
}

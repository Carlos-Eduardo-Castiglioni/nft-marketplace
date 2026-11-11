import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { createQueryClient } from './query-client'
import { createAppRouter } from './router'
import { RealtimeProvider } from '@/features/realtime/realtime'
import { AuthDialogProvider } from '@/features/auth/auth-dialog'

export function App() {
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(() => createAppRouter(queryClient))
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

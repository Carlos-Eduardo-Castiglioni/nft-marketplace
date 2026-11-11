import { lazy, Suspense } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Header } from './header'
import { Footer } from './footer'
import { BottomNav } from './bottom-nav'
import { AuthDialog } from '@/features/auth/auth-dialog'

const MockLab = lazy(() => import('@/mocks/mock-lab-panel').then((m) => ({ default: m.MockLabPanel })))

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#conteudo" className="sr-only z-50 bg-primary px-4 py-2 font-mono text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
      <AuthDialog />
      <Suspense fallback={null}>
        <MockLab />
      </Suspense>
    </div>
  )
}

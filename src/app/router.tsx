import {
  createHashHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { RootLayout } from '@/components/layout/root-layout'
import { NotFoundPage, RouteErrorPage } from '@/components/layout/status-pages'
import { sessionQuery } from '@/features/auth/api'
import { validateCatalogSearch } from '@/features/catalog/search'
import { nftDetailQuery, nftListQuery } from '@/features/catalog/api'
import { HomePage } from '@/features/catalog/home-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'

export interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
})

// ---------- Rotas públicas ----------

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  // pré-carrega sem bloquear a navegação (skeletons cuidam do estado de loading)
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps))
  },
  component: HomePage,
})

const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/market',
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps))
  },
  component: lazyRouteComponent(() => import('@/features/catalog/market-page'), 'MarketPage'),
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId))
  },
  component: lazyRouteComponent(() => import('@/features/catalog/nft-detail-page'), 'NftDetailPage'),
  pendingComponent: PageSkeleton,
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: lazyRouteComponent(() => import('@/features/cart/cart-page'), 'CartPage'),
  pendingComponent: PageSkeleton,
})

const redirectSearch = z.object({ redirect: z.string().startsWith('/').optional().catch(undefined) })

/** Rotas de autenticação: se já logado, volta para onde ia. */
const guestOnly = async ({ context, search }: { context: RouterContext; search: { redirect?: string } }) => {
  const session = await context.queryClient.ensureQueryData(sessionQuery)
  if (session) throw redirect({ to: search.redirect ?? '/' })
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: redirectSearch,
  beforeLoad: guestOnly,
  component: lazyRouteComponent(() => import('@/features/auth/auth-pages'), 'LoginPage'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: redirectSearch,
  beforeLoad: guestOnly,
  component: lazyRouteComponent(() => import('@/features/auth/auth-pages'), 'RegisterPage'),
})

const creatorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/creators',
  component: lazyRouteComponent(() => import('@/components/layout/status-pages'), 'CreatorsPage'),
})

const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/learn',
  component: lazyRouteComponent(() => import('@/components/layout/status-pages'), 'LearnPage'),
})

// ---------- Rotas privadas (protegidas pela sessão simulada no MSW) ----------

const privateRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'private',
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { session }
  },
})

const checkoutRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/checkout',
  component: lazyRouteComponent(() => import('@/features/checkout/checkout-page'), 'CheckoutPage'),
  pendingComponent: PageSkeleton,
})

const profileRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/profile',
  component: lazyRouteComponent(() => import('@/features/profile/profile-layout'), 'ProfileLayout'),
})

const profileIndexRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/features/profile/profile-form'), 'ProfileForm'),
})

const walletsRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/wallets',
  component: lazyRouteComponent(() => import('@/features/profile/wallets-page'), 'WalletsPage'),
})

const activityRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/activity',
  component: lazyRouteComponent(() => import('@/features/profile/activity-page'), 'ActivityPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/favorites',
  component: lazyRouteComponent(() => import('@/features/profile/favorites-page'), 'FavoritesPage'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  marketRoute,
  nftRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  creatorsRoute,
  learnRoute,
  privateRoute.addChildren([
    checkoutRoute,
    profileRoute.addChildren([profileIndexRoute, walletsRoute, activityRoute, favoritesRoute]),
  ]),
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    history: import.meta.env.VITE_HASH_ROUTER === '1' ? createHashHistory() : undefined,
    defaultPreload: 'intent',
    // o TanStack Query já controla frescor; o router não precisa cachear loaders
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingMs: 400,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}

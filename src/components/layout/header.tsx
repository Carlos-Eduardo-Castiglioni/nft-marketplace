import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { LogIn, LogOut, Search, ShoppingCart, User, Wallet, Activity } from 'lucide-react'
import { useSession, useLogout } from '@/features/auth/api'
import { useAuthDialog } from '@/features/auth/auth-dialog'
import { cartCount, useCart } from '@/features/cart/api'
import { useRealtime } from '@/features/realtime/realtime'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Início', exact: true },
  { to: '/market', label: 'Mercado', exact: false },
  { to: '/creators', label: 'Criadores', exact: false },
  { to: '/learn', label: 'Aprenda', exact: false },
] as const

export function Header() {
  const { data: session } = useSession()
  const { data: cart } = useCart()
  const auth = useAuthDialog()
  const count = cartCount(cart)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:h-16 sm:px-6">
        <Link to="/" className="font-mono text-sm font-bold tracking-[0.25em] text-foreground" aria-label="Kurio — página inicial">
          KURIO
        </Link>

        <nav aria-label="Principal" className="mx-auto hidden md:block">
          <ul className="flex items-center gap-8">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact, includeSearch: false }}
                  className="relative py-5 font-mono text-xs text-foreground transition-colors hover:text-primary data-[status=active]:text-primary data-[status=active]:after:absolute data-[status=active]:after:inset-x-0 data-[status=active]:after:-bottom-px data-[status=active]:after:h-0.5 data-[status=active]:after:bg-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0">
          <RealtimeIndicator />
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="hidden rounded-full p-2 text-foreground hover:text-primary md:inline-flex"
            aria-label="Buscar NFTs"
            aria-expanded={searchOpen}
            aria-controls="header-search"
          >
            <Search className="size-4" />
          </button>
          <Link to="/cart" className="relative rounded-full p-2 text-foreground hover:text-primary" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <ShoppingCart className="size-4" />
            {count > 0 && (
              <span data-testid="cart-count" className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[9px] font-bold text-primary-foreground">
                {count > 99 ? '99' : count}
              </span>
            )}
          </Link>
          {session ? (
            <UserMenu name={session.user.displayName} />
          ) : (
            <button
              type="button"
              onClick={() => auth.open('login')}
              className="ml-1 inline-flex h-7 items-center gap-1.5 rounded bg-primary px-2.5 font-mono text-[11px] font-semibold text-primary-foreground hover:bg-primary-strong"
            >
              <LogIn className="size-3.5" aria-hidden /> Entrar
            </button>
          )}
        </div>
      </div>
      {searchOpen && <HeaderSearch onDone={() => setSearchOpen(false)} />}
    </header>
  )
}

function HeaderSearch({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  return (
    <form
      id="header-search"
      role="search"
      className="mx-auto flex max-w-6xl gap-2 px-4 pb-3 sm:px-6"
      onSubmit={(e) => {
        e.preventDefault()
        navigate({ to: '/market', search: { q: q.trim() || undefined } })
        onDone()
      }}
    >
      <label htmlFor="header-search-input" className="sr-only">
        Buscar NFTs
      </label>
      <input
        id="header-search-input"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onDone()}
        placeholder="Explorar coleções"
        className="h-10 flex-1 rounded-md border border-border bg-surface px-4 font-mono text-sm focus-visible:border-primary focus-visible:outline-none"
      />
    </form>
  )
}

function RealtimeIndicator() {
  const { status } = useRealtime()
  const label = { connected: 'Ao vivo', connecting: 'Conectando', reconnecting: 'Reconectando', offline: 'Offline' }[status]
  return (
    <span className="mr-1 hidden items-center gap-1.5 font-mono text-[10px] text-subtle sm:inline-flex" role="status" aria-live="polite" data-testid="realtime-status" data-status={status}>
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          status === 'connected' ? 'bg-success' : status === 'offline' ? 'bg-destructive' : 'animate-pulse bg-warning',
        )}
      />
      {label}
    </span>
  )
}

function UserMenu({ name }: { name: string }) {
  const logout = useLogout()
  const navigate = useNavigate()
  const item =
    'flex cursor-pointer items-center gap-2 rounded px-3 py-2 font-mono text-xs text-foreground outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-primary'
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="ml-1 inline-flex h-7 items-center gap-1.5 rounded border border-primary/60 px-2.5 font-mono text-[11px] font-semibold text-primary hover:bg-primary/10"
        aria-label={`Menu da conta de ${name}`}
      >
        <User className="size-3.5" aria-hidden />
        <span className="hidden max-w-28 truncate sm:inline">{name}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-44 rounded-md border border-border bg-surface-2 p-1 shadow-xl">
          <DropdownMenu.Item className={item} onSelect={() => navigate({ to: '/profile' })}>
            <User className="size-3.5" /> Meu perfil
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => navigate({ to: '/profile/wallets' })}>
            <Wallet className="size-3.5" /> Carteiras
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => navigate({ to: '/profile/activity' })}>
            <Activity className="size-3.5" /> Atividade
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className={item}
            onSelect={() => logout.mutate(undefined, { onSettled: () => navigate({ to: '/' }) })}
          >
            <LogOut className="size-3.5" /> Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

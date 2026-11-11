import { Link } from '@tanstack/react-router'
import { Heart, Home, ScanLine, ShoppingCart, User } from 'lucide-react'
import { useSession } from '@/features/auth/api'
import { useAuthDialog } from '@/features/auth/auth-dialog'

/** Navegação inferior mobile (Figma: home, favoritos, ação central, carrinho, perfil). */
export function BottomNav() {
  const { data: session } = useSession()
  const auth = useAuthDialog()
  const item = 'flex size-11 items-center justify-center rounded-full text-foreground data-[status=active]:text-primary'
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div className="relative mx-auto flex h-16 max-w-md items-center justify-around rounded-t-3xl border-t border-border bg-surface px-4">
        <Link to="/" activeOptions={{ exact: true, includeSearch: false }} className={item} aria-label="Início">
          <Home className="size-5" />
        </Link>
        {session ? (
          <Link to="/profile/favorites" className={item} aria-label="Favoritos">
            <Heart className="size-5" />
          </Link>
        ) : (
          <button type="button" className={item} aria-label="Favoritos (entre para ver)" onClick={() => auth.open('login')}>
            <Heart className="size-5" />
          </button>
        )}
        <Link
          to="/market"
          className="-mt-8 flex size-14 items-center justify-center rounded-full bg-copper text-primary-foreground shadow-lg ring-4 ring-background"
          aria-label="Explorar mercado"
        >
          <ScanLine className="size-6" />
        </Link>
        <Link to="/cart" className={item} aria-label="Carrinho">
          <ShoppingCart className="size-5" />
        </Link>
        {session ? (
          <Link to="/profile" className={item} aria-label="Meu perfil">
            <User className="size-5" />
          </Link>
        ) : (
          <button type="button" className={item} aria-label="Entrar" onClick={() => auth.open('login')}>
            <User className="size-5" />
          </button>
        )}
      </div>
    </nav>
  )
}

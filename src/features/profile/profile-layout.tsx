import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { Activity, Download, Gift, Heart, LifeBuoy, LogOut, MapPin, User } from 'lucide-react'
import { toast } from 'sonner'
import { useLogout } from '@/features/auth/api'

const LINKS = [
  { to: '/profile', label: 'Dados do perfil', icon: User, exact: true },
  { to: '/profile/wallets', label: 'Carteiras', icon: MapPin },
  { to: '/profile/activity', label: 'Atividade', icon: Activity },
  { to: '/profile/favorites', label: 'Lista de interesse', icon: Heart },
] as const

const SOON = [
  { label: 'Ofertas', icon: Gift },
  { label: 'Arquivos baixados', icon: Download },
  { label: 'Suporte', icon: LifeBuoy },
]

export function ProfileLayout() {
  const logout = useLogout()
  const navigate = useNavigate()
  const item = 'flex w-full items-center gap-2.5 border-l-2 border-transparent px-4 py-2.5 text-[11px] text-primary transition-colors hover:bg-surface-2'
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-10 pt-6 sm:px-6 md:grid-cols-[13rem_1fr] md:gap-8">
      <aside aria-label="Meu perfil" className="h-fit bg-surface font-mono">
        <h2 className="px-4 pb-2 pt-4 text-xs font-bold">Meu perfil</h2>
        <nav>
          <ul>
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  activeOptions={{ exact: 'exact' in l }}
                  className={`${item} data-[status=active]:border-primary data-[status=active]:bg-surface-2`}
                >
                  <l.icon className="size-3.5" aria-hidden /> {l.label}
                </Link>
              </li>
            ))}
            {SOON.map((l) => (
              <li key={l.label}>
                <button type="button" className={item} onClick={() => toast.info(`${l.label}: em breve`)}>
                  <l.icon className="size-3.5" aria-hidden /> {l.label}
                </button>
              </li>
            ))}
            <li className="border-t border-border">
              <button
                type="button"
                className={`${item} font-bold`}
                onClick={() => logout.mutate(undefined, { onSettled: () => navigate({ to: '/' }) })}
              >
                <LogOut className="size-3.5" aria-hidden /> Sair
              </button>
            </li>
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 font-mono">
        <Outlet />
      </div>
    </div>
  )
}

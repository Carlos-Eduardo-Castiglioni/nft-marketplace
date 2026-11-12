import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'

export function Breadcrumbs({ items }: { items: { label: string; to?: '/' | '/market' | '/cart' | '/profile/activity' }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-4 font-mono text-[11px] font-semibold">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <Fragment key={it.label}>
            {i > 0 && <li aria-hidden className="text-subtle">/</li>}
            <li>
              {it.to ? (
                <Link to={it.to} className="hover:text-primary">
                  {it.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-foreground">
                  {it.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

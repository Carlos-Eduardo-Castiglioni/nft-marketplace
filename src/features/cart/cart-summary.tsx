import { useState } from 'react'
import { X } from 'lucide-react'
import type { Cart } from '@/lib/api-types'
import { Eth } from '@/components/ui/eth'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatEth, isZero } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useAcceptPrices, useApplyCoupon, useRemoveCoupon } from './api'

export function CouponForm({ cart, variant = 'desktop' }: { cart: Cart; variant?: 'desktop' | 'mobile' }) {
  const [code, setCode] = useState('')
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const error = apply.error ? apply.error.message : null
  const submit = () => {
    if (code.trim()) apply.mutate(code.trim(), { onSuccess: () => setCode('') })
  }

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2 font-mono text-xs">
        <span>
          Cupom <strong className="text-primary">{cart.coupon.code}</strong> aplicado
        </span>
        <button type="button" onClick={() => remove.mutate()} aria-label={`Remover cupom ${cart.coupon.code}`} className="text-muted hover:text-primary">
          <X className="size-3.5" />
        </button>
      </div>
    )
  }
  return (
    // div (não <form>) para poder ser usado dentro do formulário de checkout
    <div role="group" aria-label="Código promocional">
      <label htmlFor={`coupon-${variant}`} className={cn('mb-2 block font-mono text-[11px] font-bold', variant === 'mobile' && 'sr-only')}>
        Código promocional
      </label>
      <div className={cn('flex', variant === 'mobile' && 'rounded-full border border-border')}>
        <input
          id={`coupon-${variant}`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Digite o código promocional..."
          aria-invalid={!!error}
          aria-describedby={error ? `coupon-${variant}-error` : `coupon-${variant}-hint`}
          className={cn(
            'h-8 min-w-0 flex-1 border border-border bg-transparent px-3 font-mono text-[11px] focus-visible:border-primary focus-visible:outline-none',
            variant === 'mobile' && 'h-12 rounded-l-full border-0 px-5',
          )}
        />
        <Button
          type="button"
          onClick={submit}
          size="sm"
          loading={apply.isPending}
          className={cn('rounded-none text-[11px]', variant === 'mobile' && 'h-12 rounded-full bg-copper px-5')}
        >
          Aplicar
        </Button>
      </div>
      {error ? (
        <p id={`coupon-${variant}-error`} role="alert" className="mt-1 text-[11px] text-destructive">
          {error}
        </p>
      ) : (
        <p id={`coupon-${variant}-hint`} className="mt-1 text-[10px] text-subtle">
          Experimente KURIO10 ou LAUNCH
        </p>
      )}
    </div>
  )
}

export function Totals({ cart }: { cart: Cart }) {
  return (
    <dl className="space-y-2 font-mono text-xs" data-testid="cart-totals">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd data-testid="subtotal">
          <Eth value={cart.subtotal} />
        </dd>
      </div>
      <div className="flex justify-between">
        <dt>{cart.coupon?.label ?? 'Desconto do lançamento'}</dt>
        <dd data-testid="discount">(-) {isZero(cart.discount) ? '00.00' : formatEth(cart.discount)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>Taxa de rede</dt>
        <dd className="text-right">
          <Eth value={cart.networkFee} maxDecimals={3} minDecimals={3} />
          <span className="block text-[10px] text-primary">Taxa estimada</span>
        </dd>
      </div>
      <div className="flex justify-between border-t border-border pt-3 text-sm font-bold">
        <dt>Total</dt>
        <dd className="text-primary" data-testid="total">
          <Eth value={cart.total} />
        </dd>
      </div>
    </dl>
  )
}

/**
 * Alerta exibido quando o preço de algum item mudou (evento `nft.updated`).
 * Bloqueia a finalização até o usuário aceitar o novo valor.
 */
export const hasStockIssues = (cart: Cart) => cart.lines.some((l) => l.quantity > l.stock)

/** Alerta anunciado (role=alert) quando a disponibilidade muda com o carrinho aberto. */
export function StockAlert({ cart }: { cart: Cart }) {
  if (!hasStockIssues(cart)) return null
  return (
    <Alert variant="warning" title="A disponibilidade mudou" className="mb-4">
      <ul className="space-y-1 font-mono text-xs">
        {cart.lines
          .filter((l) => l.quantity > l.stock)
          .map((l) => (
            <li key={l.id}>
              {l.name} ({l.editionLabel}): {l.stock === 0 ? 'esgotado' : `restam ${l.stock}`}
            </li>
          ))}
      </ul>
      <p className="mt-2 text-xs">Ajuste as quantidades para continuar.</p>
    </Alert>
  )
}

export function PriceChangeAlert({ cart }: { cart: Cart }) {
  const accept = useAcceptPrices()
  if (!cart.hasPriceChanges) return null
  const changed = cart.lines.filter((l) => l.priceChanged)
  return (
    <Alert
      variant="warning"
      title="O preço mudou enquanto você finalizava"
      className="mb-4"
      action={
        <Button size="sm" onClick={() => accept.mutate()} loading={accept.isPending} data-testid="accept-prices">
          Aceitar novo valor
        </Button>
      }
    >
      <ul className="space-y-1 font-mono text-xs">
        {changed.map((l) => (
          <li key={l.id}>
            {l.name} ({l.editionLabel}): <span className="line-through">{formatEth(l.unitPrice)}</span> →{' '}
            <strong className="text-foreground">{formatEth(l.currentPrice)}</strong>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">Para sua segurança, a confirmação fica bloqueada até você aceitar os novos valores.</p>
    </Alert>
  )
}

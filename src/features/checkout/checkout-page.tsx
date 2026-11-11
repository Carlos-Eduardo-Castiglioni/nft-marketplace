import { useEffect, useState } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, MoreVertical, Wallet as WalletIcon } from 'lucide-react'
import type { Cart, Order, Wallet, WalletProvider } from '@/lib/api-types'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Button } from '@/components/ui/button'
import { Eth } from '@/components/ui/eth'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { RadioCard, RadioGroup } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { lineTotal } from '@/lib/cart-math'
import { shortAddress } from '@/lib/utils'
import { useSession } from '@/features/auth/api'
import { useCart } from '@/features/cart/api'
import { CouponForm, PriceChangeAlert, Totals } from '@/features/cart/cart-summary'
import { useWallets } from '@/features/profile/api'
import { useCreateOrder } from './api'
import { OrderSuccessDialog } from './order-success-dialog'

export const PROVIDERS: { id: WalletProvider; label: string; letter: string }[] = [
  { id: 'walletconnect', label: 'WalletConnect', letter: 'W' },
  { id: 'metamask', label: 'MetaMask', letter: 'M' },
  { id: 'coinbase', label: 'Coinbase Wallet', letter: 'C' },
]

const NETWORK_LABEL = { ethereum: 'Rede principal Ethereum', polygon: 'Rede Polygon', solana: 'Rede Solana' } as const

const checkoutSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe seu nome de exibição.'),
  email: z.string().trim().email('E-mail inválido.'),
  walletId: z.string().min(1, 'Selecione uma carteira.'),
  provider: z.enum(['walletconnect', 'metamask', 'coinbase'], { message: 'Selecione um provedor.' }),
  note: z.string().max(280, 'Máximo de 280 caracteres.').optional(),
})
type CheckoutValues = z.infer<typeof checkoutSchema>

export function CheckoutPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const cartQuery = useCart()
  const walletsQuery = useWallets()
  const createOrder = useCreateOrder()
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null)
  // snapshot do carrinho no envio: se o servidor efetivou o pedido mas a resposta
  // se perdeu, o carrinho "real" já está vazio — mantemos o resumo para o retry.
  const [submittedCart, setSubmittedCart] = useState<Cart | null>(null)

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { displayName: session?.user.displayName ?? '', email: session?.user.email ?? '', walletId: '', provider: 'coinbase', note: '' },
  })
  const { errors } = form.formState

  // seleciona a carteira principal assim que as carteiras chegam
  useEffect(() => {
    const wallets = walletsQuery.data
    if (wallets?.length && !form.getValues('walletId')) {
      const principal = wallets.find((w) => w.role === 'principal') ?? wallets[0]
      form.setValue('walletId', principal.id)
    }
  }, [walletsQuery.data, form])

  const inFlight = createOrder.isPending || (createOrder.isError && createOrder.error.isRetryable)
  const cart = inFlight && submittedCart ? submittedCart : cartQuery.data
  const blocked = !!cart?.hasPriceChanges
  const submit = form.handleSubmit((values) => {
    if (!cart || blocked) return
    setSubmittedCart(cart)
    createOrder.mutate(
      { cartVersion: cart.version, walletId: values.walletId, provider: values.provider },
      { onSuccess: (order) => setPlacedOrder(order) },
    )
  })

  const error = createOrder.error
  const recoverable = error?.isRetryable

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 md:pt-6">
      <div className="hidden md:block">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/market' }, { label: 'Pagamento' }]} />
      </div>
      <div className="mb-5 flex items-center gap-4">
        <button type="button" onClick={() => router.history.back()} className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-primary md:hidden" aria-label="Voltar">
          <ChevronLeft className="size-4" />
        </button>
        <h1 className="font-mono text-base font-bold">Pagamento com carteira</h1>
      </div>

      {cartQuery.isPending || walletsQuery.isPending ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]" aria-busy="true" aria-label="Carregando pagamento">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : !cart || (cart.lines.length === 0 && !placedOrder) ? (
        <div className="rounded-3xl bg-surface p-10 text-center font-mono">
          <p className="text-sm font-bold">Não há itens para pagar</p>
          <Button asChild className="mt-6">
            <Link to="/market">Explorar NFTs</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_22rem]" aria-label="Pagamento">
          <div className="space-y-8 font-mono">
            <section aria-labelledby="wallet-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="wallet-title" className="text-sm font-bold">
                  Carteira conectada
                </h2>
                <Link to="/profile/wallets" className="text-xs font-semibold text-primary hover:underline">
                  Trocar carteira
                </Link>
              </div>
              {walletsQuery.data?.length ? (
                <Controller
                  control={form.control}
                  name="walletId"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} aria-label="Carteira de destino" aria-invalid={!!errors.walletId}>
                      {[...walletsQuery.data].sort((a) => (a.role === 'reserva' ? -1 : 1)).map((w) => (
                        <WalletOption key={w.id} wallet={w} />
                      ))}
                    </RadioGroup>
                  )}
                />
              ) : (
                <Alert variant="info" title="Nenhuma carteira cadastrada" action={<Button asChild size="sm"><Link to="/profile/wallets">Adicionar carteira</Link></Button>}>
                  Cadastre uma carteira principal para receber seus NFTs.
                </Alert>
              )}
              {errors.walletId && (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {errors.walletId.message}
                </p>
              )}
            </section>

            <section aria-labelledby="profile-title" className="space-y-4">
              <h2 id="profile-title" className="text-sm font-bold">
                Perfil do colecionador
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome de exibição" required error={errors.displayName?.message}>
                  <Input className="h-10" autoComplete="name" {...form.register('displayName')} />
                </Field>
                <Field label="E-mail" required error={errors.email?.message}>
                  <Input className="h-10" type="email" autoComplete="email" {...form.register('email')} />
                </Field>
              </div>
              <Field label="Observação do colecionador (opcional)" error={errors.note?.message}>
                <Textarea className="sm:max-w-md" {...form.register('note')} />
              </Field>
            </section>
          </div>

          <aside aria-labelledby="order-title" className="h-fit space-y-5 rounded-3xl bg-surface p-5 font-mono md:p-6">
            <h2 id="order-title" className="text-xs font-bold">
              Seus NFTs
            </h2>
            <ul className="space-y-2" aria-label="Itens do pedido">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex items-center gap-3 bg-surface-2 p-2 text-xs">
                  <img src={l.thumb} alt="" width={40} height={40} className="size-10 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{l.name}</p>
                    <p className="text-[10px] text-primary">ID do token: #{l.tokenId}</p>
                  </div>
                  <span className="text-[10px] text-muted">(x {l.quantity})</span>
                  <Eth value={lineTotal(l)} className="font-bold text-primary" />
                </li>
              ))}
            </ul>
            <CouponForm cart={cart} />
            <Totals cart={cart} />

            <fieldset>
              <legend className="mb-3 text-xs font-bold">Carteira e rede</legend>
              <Controller
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-2" aria-label="Provedor da carteira">
                    {PROVIDERS.map((p) => (
                      <RadioCard key={p.id} value={p.id} indicator="end" className="py-2.5">
                        <span className="flex items-center gap-3 text-xs">
                          <span className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold text-primary" aria-hidden>
                            {p.id === 'coinbase' ? <WalletIcon className="size-3.5" /> : p.letter}
                          </span>
                          {p.label}
                        </span>
                      </RadioCard>
                    ))}
                  </RadioGroup>
                )}
              />
            </fieldset>

            <PriceChangeAlert cart={cart} />

            {error && !blocked && (
              <Alert
                variant="error"
                title={recoverable ? 'Não conseguimos confirmar seu pedido' : error.message}
                action={
                  recoverable ? (
                    <Button
                      type="button"
                      size="sm"
                      loading={createOrder.isPending}
                      data-testid="retry-order"
                      // reenvia exatamente a mesma intenção (mesma chave de idempotência),
                      // mesmo que o carrinho em cache já tenha sido revalidado
                      onClick={() => createOrder.variables && createOrder.mutate(createOrder.variables, { onSuccess: setPlacedOrder })}
                    >
                      Tentar novamente
                    </Button>
                  ) : undefined
                }
              >
                {recoverable
                  ? 'A conexão falhou antes da confirmação. Tentar novamente é seguro: usamos uma chave de idempotência e você não será cobrado duas vezes.'
                  : null}
              </Alert>
            )}

            <div className="flex items-baseline justify-end gap-4 text-sm font-bold">
              <span>Total:</span>
              <Eth value={cart.total} className="text-lg text-primary" />
            </div>
            <Button
              type="submit"
              variant="gradient"
              size="pill"
              className="w-full"
              disabled={blocked || !walletsQuery.data?.length}
              loading={createOrder.isPending}
              aria-describedby={blocked ? 'confirm-blocked' : undefined}
              data-testid="confirm-order"
            >
              {createOrder.isPending ? 'Confirmando…' : 'Confirmar compra'}
            </Button>
            {blocked && (
              <p id="confirm-blocked" className="text-center text-[11px] text-warning">
                Confirmação bloqueada: aceite o novo valor acima.
              </p>
            )}
          </aside>
        </form>
      )}

      <OrderSuccessDialog
        order={placedOrder}
        onClose={() => {
          setPlacedOrder(null)
          navigate({ to: '/profile/activity' })
        }}
      />
    </div>
  )
}

function WalletOption({ wallet }: { wallet: Wallet }) {
  return (
    <RadioCard value={wallet.id} className="py-4" aria-label={`${wallet.nickname} — ${wallet.address}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-sm font-bold capitalize">{wallet.role === 'principal' ? 'Principal' : 'Reserva'}</span>
          <span className="block truncate text-xs text-muted">{wallet.ensName ?? shortAddress(wallet.address)}</span>
          <span className="block text-xs text-muted">{NETWORK_LABEL[wallet.network]}</span>
        </span>
        <MoreVertical className="size-4 shrink-0 text-primary" aria-hidden />
      </span>
    </RadioCard>
  )
}

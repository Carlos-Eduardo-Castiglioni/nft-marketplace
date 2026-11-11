import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Star, Trash2 } from 'lucide-react'
import type { Wallet } from '@/lib/api-types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { shortAddress } from '@/lib/utils'
import { useCreateWallet, useDeleteWallet, usePromoteWallet, useWallets, type WalletInput } from './api'

const NETWORKS = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'solana', label: 'Solana' },
] as const
const PROVIDERS = [
  { id: 'metamask', label: 'MetaMask' },
  { id: 'walletconnect', label: 'WalletConnect' },
  { id: 'coinbase', label: 'Coinbase Wallet' },
] as const

const schema = z
  .object({
    nickname: z.string().trim().min(2, 'Informe um apelido.'),
    network: z.enum(['ethereum', 'polygon', 'solana'], { message: 'Selecione uma rede.' }),
    provider: z.enum(['metamask', 'walletconnect', 'coinbase'], { message: 'Selecione uma carteira.' }),
    address: z.string().trim().min(1, 'Informe o endereço.'),
    ensName: z.string().trim().optional(),
  })
  .superRefine((d, ctx) => {
    const evm = /^0x[a-fA-F0-9]{40}$/
    const ens = /^[a-z0-9-]+\.eth$/i
    const sol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    const ok = d.network === 'solana' ? sol.test(d.address) : evm.test(d.address) || ens.test(d.address)
    if (!ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: d.network === 'solana' ? 'Endereço Solana inválido.' : 'Use um endereço 0x (40 hex) ou um nome .eth.',
      })
    }
  })

type Values = z.infer<typeof schema>

export function WalletsPage() {
  const { data: wallets, isPending } = useWallets()
  const principal = wallets?.find((w) => w.role === 'principal')
  const reserva = wallets?.find((w) => w.role === 'reserva')
  const [editing, setEditing] = useState<Wallet['role'] | null>(null)

  if (isPending) return <Skeleton className="h-96 w-full" />

  return (
    <div className="max-w-2xl space-y-10">
      <WalletSection
        role="principal"
        title="Carteira principal"
        description="Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados."
        wallet={principal}
        editing={editing === 'principal' || !principal}
        onEdit={() => setEditing('principal')}
        onDone={() => setEditing(null)}
      />
      <WalletSection
        role="reserva"
        title="Carteira secundária"
        description={reserva ? 'Usada como reserva quando a principal estiver indisponível.' : 'Você ainda não adicionou uma carteira secundária.'}
        wallet={reserva}
        editing={editing === 'reserva'}
        onEdit={() => setEditing('reserva')}
        onDone={() => setEditing(null)}
      />
    </div>
  )
}

function WalletSection(props: {
  role: Wallet['role']
  title: string
  description: string
  wallet?: Wallet
  editing: boolean
  onEdit: () => void
  onDone: () => void
}) {
  const { role, title, description, wallet, editing, onEdit, onDone } = props
  const promote = usePromoteWallet()
  const del = useDeleteWallet()
  const headingId = `wallet-${role}`
  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={headingId} className="text-xs font-bold">
            {title}
          </h2>
          <p className="mt-1 text-[11px] text-muted">{description}</p>
        </div>
        {!editing && (
          <button type="button" onClick={onEdit} className="text-[11px] font-bold text-primary hover:underline">
            {wallet ? 'Editar' : 'Adicionar'}
          </button>
        )}
      </div>
      {wallet && !editing && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-surface p-4" data-testid={`wallet-card-${role}`}>
          <div className="min-w-0 text-xs">
            <p className="flex items-center gap-2 font-bold">
              {wallet.nickname} <Badge variant={role === 'principal' ? 'outline' : 'muted'}>{role}</Badge>
            </p>
            <p className="mt-1 truncate text-muted" title={wallet.address}>
              {wallet.ensName ?? shortAddress(wallet.address)}
            </p>
            <p className="text-subtle">
              {NETWORKS.find((n) => n.id === wallet.network)?.label} · {PROVIDERS.find((p) => p.id === wallet.provider)?.label}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {role === 'reserva' && (
              <Button size="sm" variant="outline-primary" onClick={() => promote.mutate(wallet.id, { onSuccess: () => toast.success(`${wallet.nickname} agora é a principal`) })}>
                <Star className="size-3.5" /> Tornar principal
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" aria-label={`Remover carteira ${wallet.nickname}`} onClick={() => del.mutate(wallet.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
      {editing && <WalletForm role={role} initial={wallet} onDone={onDone} />}
    </section>
  )
}

function WalletForm({ role, initial, onDone }: { role: Wallet['role']; initial?: Wallet; onDone: () => void }) {
  const create = useCreateWallet()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? { nickname: initial.nickname, network: initial.network, provider: initial.provider, address: initial.address, ensName: initial.ensName ?? '' }
      : { nickname: '', address: '', ensName: '' },
  })
  const { errors } = form.formState
  const submit = form.handleSubmit((values) => {
    const input: WalletInput = { ...values, role, ensName: values.ensName || undefined }
    create.mutate(input, {
      onSuccess: () => {
        toast.success('Carteira salva!')
        onDone()
      },
    })
  })
  return (
    <form onSubmit={submit} noValidate className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2" aria-label={`Formulário da carteira ${role}`}>
      <Field label="Apelido da carteira" required error={errors.nickname?.message}>
        <Input className="h-9" {...form.register('nickname')} />
      </Field>
      <Field label="Rede" required error={errors.network?.message}>
        <Controller
          control={form.control}
          name="network"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione uma rede" />
              </SelectTrigger>
              <SelectContent>
                {NETWORKS.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Endereço da carteira" required error={errors.address?.message}>
        <Input className="h-9" placeholder="Endereço 0x da carteira" spellCheck={false} {...form.register('address')} />
      </Field>
      <Field label="ENS (opcional)" error={errors.ensName?.message}>
        <Input className="h-9" placeholder="ENS ou carteira secundária (opcional)" {...form.register('ensName')} />
      </Field>
      <Field label="Tipo de carteira" required error={errors.provider?.message}>
        <Controller
          control={form.control}
          name="provider"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione uma carteira" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <div className="flex items-end gap-2 sm:col-span-2">
        <Button type="submit" size="sm" loading={create.isPending}>
          Salvar carteira
        </Button>
        {initial && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}

import { formatEth, type EthString } from '@/lib/eth'
import { cn } from '@/lib/utils'

/** Valor em ETH sempre em fonte monoespaçada e com números tabulares. */
export function Eth({ value, className, ...opts }: { value: EthString; className?: string; minDecimals?: number; maxDecimals?: number }) {
  return <span className={cn('font-mono tabular', className)}>{formatEth(value, opts)}</span>
}

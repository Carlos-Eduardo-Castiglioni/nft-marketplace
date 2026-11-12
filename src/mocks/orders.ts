/**
 * Ciclo de vida do pedido na simulação "on-chain".
 *
 *   POST /api/orders ──► pending ──(settleAt)──► confirmed | failed   (terminais)
 *
 * - O instante de liquidação (`settleAt`) fica no banco persistido: se a página
 *   recarregar com o pedido pendente, a liquidação é reagendada no boot e o
 *   cliente recupera o estado via REST + `order.updated`.
 * - confirmed: baixa o estoque e remove do carrinho APENAS os itens/quantidades
 *   comprados (o visitante pode ter adicionado outros enquanto aguardava).
 * - failed: nada muda no carrinho nem no estoque — os itens são preservados.
 * - Com `mockConfig.payment = 'manual'` a liquidação só acontece via
 *   `__kurioMock.settleOrder(id, outcome)` (determinístico nos testes).
 */
import { bumpNft, db, onReset, persist, type OrderRecord } from './db'
import { emitNftUpdated, emitOrderUpdated } from './realtime'
import { mockConfig } from './scenarios'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const DECLINED_REASON = 'Pagamento recusado pela carteira (simulado).'

export function planSettlement(order: OrderRecord) {
  if (mockConfig.payment === 'manual') return
  order.outcome = mockConfig.payment === 'decline' ? 'failed' : 'confirmed'
  order.settleAt = Date.now() + mockConfig.settleDelay
}

export function scheduleSettlement(order: OrderRecord) {
  if (order.status !== 'pending' || order.settleAt === undefined) return
  clearTimeout(timers.get(order.id))
  timers.set(
    order.id,
    setTimeout(() => settleOrder(order.id), Math.max(0, order.settleAt - Date.now())),
  )
}

export function settleOrder(id: string, outcome?: 'confirmed' | 'failed', reason?: string) {
  const order = db.state.orders[id]
  if (!order || order.status !== 'pending') return false
  clearTimeout(timers.get(id))
  timers.delete(id)

  let status = outcome ?? order.outcome ?? 'confirmed'
  let failureReason = status === 'failed' ? (reason ?? DECLINED_REASON) : undefined

  if (status === 'confirmed') {
    const soldOut = order.lines.find((l) => (db.state.nfts[l.nftId]?.stock[l.editionId] ?? 0) < l.quantity)
    if (soldOut) {
      status = 'failed'
      failureReason = `A edição ${soldOut.editionLabel} de ${soldOut.name} esgotou antes da confirmação.`
    }
  }

  if (status === 'confirmed') {
    for (const l of order.lines) {
      const n = db.state.nfts[l.nftId]
      n.stock[l.editionId] -= l.quantity
      emitNftUpdated({ id: n.id, version: bumpNft(n.id), editionId: l.editionId, stock: n.stock[l.editionId] })
    }
    const cart = db.state.carts[order.cartId]
    if (cart) {
      for (const bought of order.lines) {
        const line = cart.lines.find((c) => c.nftId === bought.nftId && c.editionId === bought.editionId)
        if (line) line.quantity -= bought.quantity
      }
      cart.lines = cart.lines.filter((l) => l.quantity > 0)
      if (order.coupon && cart.couponCode === order.coupon.code) cart.couponCode = undefined
      cart.version += 1
    }
  }

  order.status = status
  order.failureReason = failureReason
  order.version += 1
  order.settledAt = new Date().toISOString()
  delete order.settleAt
  persist()
  emitOrderUpdated({ id, version: order.version, userId: order.ownerId, status, failureReason })
  return true
}

/** Reagenda liquidações pendentes (boot após refresh) e liquida as vencidas. */
export function resumePendingSettlements() {
  for (const o of Object.values(db.state.orders)) scheduleSettlement(o)
}

onReset(() => {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
})

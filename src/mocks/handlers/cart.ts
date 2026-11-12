import { http, HttpResponse } from 'msw'
import type { Cart, CartLine, EditionId, Order, WalletProvider } from '@/lib/api-types'
import { COUPONS, computeTotals } from '@/lib/cart-math'
import { eq } from '@/lib/eth'
import { uuid } from '@/lib/utils'
import { db, persist, type CartRecord, type OrderRecord } from '../db'
import { ART, EDITIONS, editionPrice } from '../fixtures/nfts'
import { apiError, getCartId, getUser, requireUser, withScenario } from '../http'
import { planSettlement, resumePendingSettlements, scheduleSettlement } from '../orders'

// pedidos pendentes de uma sessão anterior (refresh) voltam a ser liquidados
resumePendingSettlements()

function getCart(id: string): CartRecord {
  db.state.carts[id] ??= { id, version: 1, lines: [] }
  return db.state.carts[id]
}

export function serializeCart(c: CartRecord): Cart {
  const lines: CartLine[] = c.lines
    .filter((l) => db.state.nfts[l.nftId])
    .map((l) => {
      const n = db.state.nfts[l.nftId]
      const edition = EDITIONS.find((e) => e.id === l.editionId)!
      const currentPrice = editionPrice(n.basePrice, l.editionId)
      return {
        id: l.id,
        nftId: n.id,
        name: n.name,
        tokenId: n.tokenId,
        thumb: ART[n.art].thumb,
        editionId: l.editionId,
        editionLabel: edition.label,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        currentPrice,
        stock: n.stock[l.editionId],
        maxPerOrder: edition.maxPerOrder,
        priceChanged: !eq(l.unitPrice, currentPrice),
      }
    })
  const coupon = c.couponCode ? COUPONS[c.couponCode] : undefined
  const totals = computeTotals(lines, coupon)
  return {
    id: c.id,
    version: c.version,
    lines,
    coupon: coupon ? { code: coupon.code, label: coupon.label } : undefined,
    ...totals,
    hasPriceChanges: lines.some((l) => l.priceChanged),
  }
}

/** Cupons que existiram mas expiraram (cenário determinístico de "cupom expirado"). */
const EXPIRED_COUPONS = ['BLACK2025']

function touch(c: CartRecord) {
  c.version += 1
  persist()
  return HttpResponse.json(serializeCart(c))
}

/**
 * Chave do carrinho: autenticado => carrinho do usuário (`user:<id>`);
 * visitante => carrinho anônimo do navegador (`X-Cart-Id`).
 * Assim, dados de um usuário nunca aparecem para o próximo que usar o navegador.
 */
function requireCartId(request: Request) {
  const user = getUser(request)
  if (user) return `user:${user.id}`
  const id = getCartId(request)
  if (!id) throw apiError(400, 'NO_CART', 'Cabeçalho X-Cart-Id ausente.')
  return id
}

/** Ao autenticar, os itens do visitante são preservados: mesclados no carrinho do usuário. */
export function mergeVisitorCart(visitorCartId: string | null, userId: string) {
  if (!visitorCartId) return
  const visitor = db.state.carts[visitorCartId]
  if (!visitor) return
  const target = getCart(`user:${userId}`)
  for (const l of visitor.lines) {
    const n = db.state.nfts[l.nftId]
    const edition = EDITIONS.find((e) => e.id === l.editionId)
    if (!n || !edition) continue
    const limit = Math.max(1, Math.min(n.stock[l.editionId], edition.maxPerOrder))
    const existing = target.lines.find((t) => t.nftId === l.nftId && t.editionId === l.editionId)
    if (existing) existing.quantity = Math.min(limit, existing.quantity + l.quantity)
    else target.lines.push({ ...l, quantity: Math.min(limit, l.quantity) })
  }
  target.couponCode ??= visitor.couponCode
  if (visitor.lines.length) target.version += 1
  delete db.state.carts[visitorCartId]
  persist()
}

function validateQuantity(nftId: string, editionId: EditionId, quantity: number) {
  const n = db.state.nfts[nftId]
  const edition = EDITIONS.find((e) => e.id === editionId)
  if (!n || !edition) return apiError(404, 'NFT_NOT_FOUND', 'NFT ou edição não encontrados.')
  if (!Number.isInteger(quantity) || quantity < 1) return apiError(422, 'INVALID_QUANTITY', 'Quantidade inválida.')
  const limit = Math.min(n.stock[editionId], edition.maxPerOrder)
  if (quantity > limit) {
    return apiError(422, 'QUANTITY_LIMIT', `Limite de ${limit} unidade(s) para esta edição.`, { limit })
  }
  return null
}

export const cartHandlers = [
  http.get(
    '*/api/cart',
    withScenario('cart.get', ({ request }) => HttpResponse.json(serializeCart(getCart(requireCartId(request))))),
  ),

  http.post(
    '*/api/cart/items',
    withScenario('cart.mutate', async ({ request }) => {
      const cart = getCart(requireCartId(request))
      const { nftId, editionId, quantity } = (await request.json()) as { nftId: string; editionId: EditionId; quantity: number }
      const existing = cart.lines.find((l) => l.nftId === nftId && l.editionId === editionId)
      const nextQty = (existing?.quantity ?? 0) + quantity
      const err = validateQuantity(nftId, editionId, nextQty)
      if (err) return err
      const price = editionPrice(db.state.nfts[nftId].basePrice, editionId)
      if (existing) {
        existing.quantity = nextQty
        existing.unitPrice = price
      } else {
        cart.lines.push({ id: `line-${uuid()}`, nftId, editionId, quantity, unitPrice: price })
      }
      return touch(cart)
    }),
  ),

  http.patch(
    '*/api/cart/items/:lineId',
    withScenario('cart.mutate', async ({ request, params }) => {
      const cart = getCart(requireCartId(request))
      const line = cart.lines.find((l) => l.id === params.lineId)
      if (!line) return apiError(404, 'LINE_NOT_FOUND', 'Item não está no carrinho.')
      const { quantity } = (await request.json()) as { quantity: number }
      const err = validateQuantity(line.nftId, line.editionId, quantity)
      if (err) return err
      line.quantity = quantity
      return touch(cart)
    }),
  ),

  http.delete(
    '*/api/cart/items/:lineId',
    withScenario('cart.mutate', ({ request, params }) => {
      const cart = getCart(requireCartId(request))
      cart.lines = cart.lines.filter((l) => l.id !== params.lineId)
      return touch(cart)
    }),
  ),

  http.post(
    '*/api/cart/coupon',
    withScenario('cart.mutate', async ({ request }) => {
      const cart = getCart(requireCartId(request))
      const { code } = (await request.json()) as { code: string }
      const normalized = (code ?? '').trim().toUpperCase()
      if (EXPIRED_COUPONS.includes(normalized)) {
        return apiError(422, 'COUPON_EXPIRED', 'Este código promocional expirou.', { field: 'code' })
      }
      if (!COUPONS[normalized]) return apiError(422, 'INVALID_COUPON', 'Código promocional inválido ou expirado.', { field: 'code' })
      cart.couponCode = normalized
      return touch(cart)
    }),
  ),

  http.delete(
    '*/api/cart/coupon',
    withScenario('cart.mutate', ({ request }) => {
      const cart = getCart(requireCartId(request))
      cart.couponCode = undefined
      return touch(cart)
    }),
  ),

  /** Aceita os novos preços: trava o preço vigente em todas as linhas. */
  http.post(
    '*/api/cart/accept-prices',
    withScenario('cart.mutate', ({ request }) => {
      const cart = getCart(requireCartId(request))
      for (const l of cart.lines) {
        const n = db.state.nfts[l.nftId]
        if (n) l.unitPrice = editionPrice(n.basePrice, l.editionId)
      }
      return touch(cart)
    }),
  ),
]

/** Hash de transação fictício, determinístico por pedido (FNV-1a encadeado). */
function fakeTxHash(seed: string) {
  let out = ''
  let h = 0x811c9dc5
  for (let round = 0; out.length < 64; round++) {
    for (const ch of `${seed}:${round}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0
    out += h.toString(16).padStart(8, '0')
  }
  return `0x${out.slice(0, 64)}`
}

function toPublicOrder(o: OrderRecord): Order {
  const { ownerId: _o, cartId: _c, settleAt: _s, outcome: _out, ...order } = o
  return order
}

export const orderHandlers = [
  /**
   * Cria um pedido de forma idempotente (status inicial `pending`).
   * - Mesmo `Idempotency-Key` + mesmo conteúdo => devolve o pedido já criado (200).
   * - Mesmo `Idempotency-Key` + conteúdo diferente => 409 IDEMPOTENCY_CONFLICT.
   * - Já existe pedido pendente deste carrinho => 409 ORDER_PENDING (não duplica a compra).
   * - Preço/estoque/cupom mudou desde a cotação => 409 (cliente precisa revisar e reconfirmar).
   * O carrinho só é alterado quando o pedido é CONFIRMADO (ver mocks/orders.ts).
   */
  http.post(
    '*/api/orders',
    withScenario('orders.create', async ({ request }) => {
      const user = requireUser(request)
      const key = request.headers.get('idempotency-key')
      if (!key) return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Cabeçalho Idempotency-Key é obrigatório.')
      const body = (await request.json()) as { cartVersion: number; walletId: string; provider: WalletProvider; total?: string }
      const cartId = requireCartId(request)
      const fingerprint = `${user.id}:${cartId}:${body.cartVersion}:${body.walletId}:${body.provider}:${body.total ?? ''}`

      const previous = db.state.idempotency[key]
      if (previous) {
        if (previous.fingerprint !== fingerprint) {
          return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Chave de idempotência reutilizada com outro conteúdo.')
        }
        const order = db.state.orders[previous.orderId]
        return HttpResponse.json(toPublicOrder(order), { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
      }

      const pending = Object.values(db.state.orders).find((o) => o.ownerId === user.id && o.cartId === cartId && o.status === 'pending')
      if (pending) {
        return apiError(409, 'ORDER_PENDING', 'Já existe um pedido aguardando confirmação para este carrinho.', { orderId: pending.id })
      }

      const cart = getCart(cartId)
      if (cart.version !== body.cartVersion) {
        return apiError(409, 'CART_VERSION_MISMATCH', 'O carrinho mudou. Revise antes de confirmar.')
      }
      const serialized = serializeCart(cart)
      if (!serialized.lines.length) return apiError(422, 'EMPTY_CART', 'Seu carrinho está vazio.')
      if (serialized.hasPriceChanges) {
        return apiError(409, 'PRICE_CHANGED', 'O preço de um ou mais itens mudou. Aceite o novo valor para continuar.', {
          lines: serialized.lines.filter((l) => l.priceChanged).map((l) => ({ id: l.id, from: l.unitPrice, to: l.currentPrice })),
        })
      }
      for (const l of serialized.lines) {
        if (l.quantity > l.stock) {
          return apiError(409, 'OUT_OF_STOCK', `Estoque insuficiente para ${l.name}.`, { lineId: l.id })
        }
      }
      if (body.total !== undefined && body.total !== serialized.total) {
        return apiError(409, 'QUOTE_CHANGED', 'O total mudou desde a revisão. Confirme novamente.', { total: serialized.total })
      }
      const wallet = (db.state.wallets[user.id] ?? []).find((w) => w.id === body.walletId)
      if (!wallet) return apiError(422, 'WALLET_REQUIRED', 'Selecione uma carteira válida.', { field: 'walletId' })

      const id = `ord-${uuid().slice(0, 8)}`
      const order: OrderRecord = {
        id,
        ownerId: user.id,
        cartId,
        txHash: fakeTxHash(id),
        status: 'pending',
        version: 1,
        createdAt: new Date().toISOString(),
        lines: serialized.lines.map(({ nftId, name, tokenId, thumb, editionId, editionLabel, quantity, unitPrice }) => ({
          nftId,
          name,
          tokenId,
          thumb,
          editionId,
          editionLabel,
          quantity,
          unitPrice,
        })),
        coupon: serialized.coupon,
        subtotal: serialized.subtotal,
        discount: serialized.discount,
        networkFee: serialized.networkFee,
        total: serialized.total,
        wallet: { nickname: wallet.nickname, address: wallet.address, network: wallet.network },
        provider: body.provider,
        idempotencyKey: key,
      }
      planSettlement(order)
      db.state.orders[id] = order
      db.state.idempotency[key] = { orderId: id, fingerprint }
      persist()
      // confirmação "on-chain" assíncrona, notificada via Socket.IO (`order.updated`)
      scheduleSettlement(order)

      return HttpResponse.json(toPublicOrder(order), { status: 201 })
    }),
  ),

  http.get(
    '*/api/orders',
    withScenario('orders.list', ({ request }) => {
      const user = requireUser(request)
      const orders = Object.values(db.state.orders)
        .filter((o) => o.ownerId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toPublicOrder)
      return HttpResponse.json(orders)
    }),
  ),

  http.get(
    '*/api/orders/:id',
    withScenario('orders.get', ({ request, params }) => {
      const user = requireUser(request)
      const o = db.state.orders[params.id as string]
      if (!o) return apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
      if (o.ownerId !== user.id) return apiError(403, 'FORBIDDEN', 'Este pedido pertence a outra conta.')
      return HttpResponse.json(toPublicOrder(o))
    }),
  ),
]

import { http, HttpResponse } from 'msw'
import type { Cart, CartLine, EditionId, Order, WalletProvider } from '@/lib/api-types'
import { COUPONS, computeTotals } from '@/lib/cart-math'
import { eq } from '@/lib/eth'
import { uuid } from '@/lib/utils'
import { db, persist, type CartRecord } from '../db'
import { ART, EDITIONS, editionPrice } from '../fixtures/nfts'
import { apiError, getCartId, requireUser, withScenario } from '../http'
import { broadcast } from '../realtime'

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

function touch(c: CartRecord) {
  c.version += 1
  persist()
  return HttpResponse.json(serializeCart(c))
}

function requireCartId(request: Request) {
  const id = getCartId(request)
  if (!id) throw apiError(400, 'NO_CART', 'Cabeçalho X-Cart-Id ausente.')
  return id
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

function fakeTxHash(seed: string) {
  let h = 0n
  for (const ch of seed) h = (h * 131n + BigInt(ch.charCodeAt(0))) % 2n ** 160n
  return `0x${h.toString(16).padStart(40, '0')}${seed.replace(/-/g, '').slice(0, 24)}`
}

export const orderHandlers = [
  /**
   * Cria um pedido de forma idempotente.
   * - Mesmo `Idempotency-Key` + mesmo carrinho => devolve o pedido já criado (200).
   * - Mesmo `Idempotency-Key` + payload diferente => 422.
   * - Preço mudou desde que foi travado => 409 PRICE_CHANGED (cliente precisa aceitar).
   */
  http.post(
    '*/api/orders',
    withScenario('orders.create', async ({ request }) => {
      const user = requireUser(request)
      const key = request.headers.get('idempotency-key')
      if (!key) return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Cabeçalho Idempotency-Key é obrigatório.')
      const body = (await request.json()) as { cartVersion: number; walletId: string; provider: WalletProvider }
      const cartId = requireCartId(request)
      const fingerprint = `${user.id}:${cartId}:${body.cartVersion}:${body.walletId}:${body.provider}`

      const previous = db.state.idempotency[key]
      if (previous) {
        if (previous.fingerprint !== fingerprint) {
          return apiError(422, 'IDEMPOTENCY_MISMATCH', 'Chave de idempotência reutilizada com outro payload.')
        }
        const order = db.state.orders[previous.orderId]
        return HttpResponse.json(order, { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
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
      const wallet = (db.state.wallets[user.id] ?? []).find((w) => w.id === body.walletId)
      if (!wallet) return apiError(422, 'WALLET_REQUIRED', 'Selecione uma carteira válida.', { field: 'walletId' })

      const id = `ord-${uuid().slice(0, 8)}`
      const order: Order & { ownerId: string } = {
        id,
        ownerId: user.id,
        txHash: fakeTxHash(id),
        status: 'pending',
        createdAt: new Date().toISOString(),
        lines: serialized.lines.map(({ nftId, name, tokenId, thumb, editionLabel, quantity, unitPrice }) => ({
          nftId,
          name,
          tokenId,
          thumb,
          editionLabel,
          quantity,
          unitPrice,
        })),
        subtotal: serialized.subtotal,
        discount: serialized.discount,
        networkFee: serialized.networkFee,
        total: serialized.total,
        wallet: { nickname: wallet.nickname, address: wallet.address, network: wallet.network },
        provider: body.provider,
        idempotencyKey: key,
      }
      // baixa de estoque + limpeza do carrinho
      for (const l of cart.lines) db.state.nfts[l.nftId].stock[l.editionId] -= l.quantity
      cart.lines = []
      cart.couponCode = undefined
      cart.version += 1
      db.state.orders[id] = order
      db.state.idempotency[key] = { orderId: id, fingerprint }
      persist()

      // confirmação "on-chain" assíncrona, notificada via Socket.IO
      setTimeout(() => {
        const o = db.state.orders[id]
        if (!o) return
        o.status = 'confirmed'
        persist()
        broadcast('order.updated', { id, status: 'confirmed', at: new Date().toISOString() })
      }, 1200)

      return HttpResponse.json(order, { status: 201 })
    }),
  ),

  http.get(
    '*/api/orders',
    withScenario('orders.list', ({ request }) => {
      const user = requireUser(request)
      const orders = Object.values(db.state.orders)
        .filter((o) => o.ownerId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return HttpResponse.json(orders)
    }),
  ),

  http.get(
    '*/api/orders/:id',
    withScenario('orders.list', ({ request, params }) => {
      const user = requireUser(request)
      const o = db.state.orders[params.id as string]
      if (!o || o.ownerId !== user.id) return apiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
      return HttpResponse.json(o)
    }),
  ),
]

/**
 * Servidor Socket.IO simulado via MSW (`ws.link`) + `@mswjs/socket.io-binding`.
 *
 * - Cada conexão é associada ao usuário do token enviado no handshake
 *   (`?token=` na URL do WebSocket); conexões anônimas recebem só eventos públicos.
 * - `nft.updated` é público (broadcast); `order.updated` vai apenas para as
 *   conexões do dono do pedido — eventos nunca vazam entre usuários.
 * - Todo evento recebe um `eventId` estável; `replayLastEvent` reenvia o mesmo
 *   evento (mesmo id) para testar a deduplicação no cliente.
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/lib/api-types'
import { uuid } from '@/lib/utils'
import { db } from './db'

import { SOCKET_URL } from '@/lib/config'
export { SOCKET_URL }

const realtime = ws.link(`${SOCKET_URL}/*`)

type Io = ReturnType<typeof toSocketIo>
interface Conn {
  io: Io
  userId: string | null
  close: () => void
}

const connections = new Set<Conn>()
let paused = false
const connectListeners = new Set<() => void>()

type RealtimeConnection = Parameters<typeof toSocketIo>[0]

export function handleRealtimeConnection(connection: RealtimeConnection) {
  if (paused) {
    // "servidor fora do ar": recusa a conexão para forçar novas tentativas
    // fecha após o "open" do WebSocket; fechar ainda em CONNECTING não emite eventos
    setTimeout(() => connection.client.close(4000, 'server unavailable'), 30)
    return
  }
  const token = connection.client.url.searchParams.get('token')
  const userId = token ? (db.state.sessions[token] ?? null) : null
  const io = toSocketIo(connection)
  // Engine.IO: o servidor deve enviar "ping" (2) periodicamente; o cliente responde "pong" (3).
  const heartbeat = setInterval(() => connection.client.send('2'), 20_000)
  const conn: Conn = { io, userId, close: () => connection.client.close() }
  connections.add(conn)
  connection.client.addEventListener('close', () => {
    clearInterval(heartbeat)
    connections.delete(conn)
  })
  io.client.on('ping:kurio', () => io.client.emit('pong:kurio', { at: new Date().toISOString() }))
  for (const fn of connectListeners) fn()
}

export const realtimeHandler = realtime.addEventListener('connection', handleRealtimeConnection)

export const onRealtimeConnect = (fn: () => void) => connectListeners.add(fn)

type Outgoing =
  | { event: 'nft.updated'; payload: NftUpdatedEvent }
  | { event: 'order.updated'; payload: OrderUpdatedEvent }

let lastEvent: Outgoing | null = null

function deliver(msg: Outgoing) {
  lastEvent = msg
  for (const c of connections) {
    if (msg.event === 'order.updated' && c.userId !== msg.payload.userId) continue
    c.io.client.emit(msg.event, msg.payload)
  }
}

export function emitNftUpdated(payload: Omit<NftUpdatedEvent, 'eventId' | 'at'>) {
  deliver({ event: 'nft.updated', payload: { eventId: `evt_${uuid()}`, at: new Date().toISOString(), ...payload } })
}

export function emitOrderUpdated(payload: Omit<OrderUpdatedEvent, 'eventId' | 'at'>) {
  deliver({ event: 'order.updated', payload: { eventId: `evt_${uuid()}`, at: new Date().toISOString(), ...payload } })
}

/** Reenvia o último evento com o MESMO `eventId` (duplicata). */
export function replayLastEvent() {
  if (lastEvent) deliver(lastEvent)
}

/**
 * Envia um evento "atrasado": versão anterior à atual do recurso, com eventId novo.
 * O cliente deve ignorá-lo para não regredir o estado.
 */
export function emitStaleNftEvent(nftId: string, price: string) {
  const n = db.state.nfts[nftId]
  if (!n) throw new Error(`NFT ${nftId} não existe`)
  emitNftUpdated({ id: nftId, version: Math.max(0, n.version - 1), price })
}

export function connectionCount() {
  return connections.size
}

/** Derruba todas as conexões. Com `pauseMs`, recusa reconexões por esse período. */
export function dropConnections(pauseMs = 0) {
  if (pauseMs > 0) {
    paused = true
    setTimeout(() => {
      paused = false
    }, pauseMs)
  }
  for (const c of [...connections]) c.close()
}

/** Fica fora do ar até `resumeConnections()` (cenário determinístico nos testes). */
export function pauseConnections() {
  paused = true
  for (const c of [...connections]) c.close()
}

export function resumeConnections() {
  paused = false
}

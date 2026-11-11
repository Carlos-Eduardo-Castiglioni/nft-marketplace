/**
 * Servidor Socket.IO simulado via MSW (`ws.link`) + `@mswjs/socket.io-binding`.
 * Mantém as conexões ativas para permitir "broadcast" de eventos e expõe
 * utilitários para derrubar conexões (testes de reconexão).
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/lib/api-types'

import { SOCKET_URL } from '@/lib/config'
export { SOCKET_URL }

const realtime = ws.link(`${SOCKET_URL}/*`)

type Io = ReturnType<typeof toSocketIo>
interface Conn {
  io: Io
  close: () => void
}

const connections = new Set<Conn>()
let paused = false

type RealtimeConnection = Parameters<typeof toSocketIo>[0]

export function handleRealtimeConnection(connection: RealtimeConnection) {
  if (paused) {
    // "servidor fora do ar": recusa a conexão para forçar novas tentativas
    // fecha após o "open" do WebSocket; fechar ainda em CONNECTING não emite eventos
    setTimeout(() => connection.client.close(4000, 'server unavailable'), 30)
    return
  }
  const io = toSocketIo(connection)
  // Engine.IO: o servidor deve enviar "ping" (2) periodicamente; o cliente responde "pong" (3).
  const heartbeat = setInterval(() => connection.client.send('2'), 20_000)
  const conn: Conn = {
    io,
    close: () => connection.client.close(),
  }
  connections.add(conn)
  connection.client.addEventListener('close', () => {
    clearInterval(heartbeat)
    connections.delete(conn)
  })
  io.client.on('ping:kurio', () => io.client.emit('pong:kurio', { at: new Date().toISOString() }))
}

export const realtimeHandler = realtime.addEventListener('connection', handleRealtimeConnection)

export function broadcast(event: 'nft.updated', payload: NftUpdatedEvent): void
export function broadcast(event: 'order.updated', payload: OrderUpdatedEvent): void
export function broadcast(event: string, payload: unknown) {
  for (const c of connections) c.io.client.emit(event, payload)
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

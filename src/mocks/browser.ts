import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { mockLab } from './lab'
import { initScenariosFromEnvironment } from './scenarios'

/**
 * Inicia o backend simulado.
 *
 * 1. Modo padrão: Service Worker do MSW intercepta as requisições do Axios.
 * 2. Fallback: se o worker não puder ser registrado (iframe sandbox, WebView,
 *    file://), o MSW passa a interceptar `fetch`/`XMLHttpRequest` no próprio
 *    thread principal. O WebSocket (Socket.IO) é interceptado em ambos os modos.
 */
export async function startMocks() {
  initScenariosFromEnvironment()
  window.__kurioMock = mockLab
  const forceInline = new URLSearchParams(window.location.search).get('mockMode') === 'inline'

  const workerUrl = new URL('mockServiceWorker.js', document.baseURI).pathname
  if (!forceInline && (await canRegisterServiceWorker(workerUrl))) {
    try {
      await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass', quiet: true, serviceWorker: { url: workerUrl } })
      window.__kurioMockMode = 'service-worker'
      return
    } catch (error) {
      console.warn('[kurio] Service Worker indisponível, usando interceptação inline.', error)
    }
  }

  // Esconde a API de Service Worker para o MSW escolher a fonte "fallback".
  try {
    delete (Navigator.prototype as unknown as Record<string, unknown>).serviceWorker
  } catch {
    /* ignore */
  }
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass', quiet: true })
  // No modo fallback o MSW não intercepta WebSocket: ligamos o interceptador direto.
  const { WebSocketInterceptor } = await import('@mswjs/interceptors/WebSocket')
  const { handleRealtimeConnection, SOCKET_URL } = await import('./realtime')
  const interceptor = new WebSocketInterceptor()
  interceptor.on('connection', (connection) => {
    if (connection.client.url.href.startsWith(SOCKET_URL)) {
      handleRealtimeConnection({ ...connection, params: {} } as unknown as Parameters<typeof handleRealtimeConnection>[0])
    } else {
      connection.server.connect()
    }
  })
  interceptor.apply()
  window.__kurioMockMode = 'inline'
}

/**
 * Testa o registro antes de entregar ao MSW: uma tentativa malsucedida de
 * `worker.start()` deixa a interceptação inline inconsistente na mesma página.
 */
async function canRegisterServiceWorker(url: string) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return false
  try {
    const registration = await navigator.serviceWorker.register(url)
    return !!registration
  } catch {
    return false
  }
}

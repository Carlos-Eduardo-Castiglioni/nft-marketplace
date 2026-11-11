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

  if (!forceInline) {
    try {
      await setupWorker(...handlers).start({
        onUnhandledRequest: 'bypass',
        quiet: true,
        serviceWorker: { url: new URL('mockServiceWorker.js', document.baseURI).pathname },
      })
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
  window.__kurioMockMode = 'inline'
}

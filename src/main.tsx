import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

async function bootstrap() {
  // Não há backend real: o MSW precisa estar ativo antes da primeira requisição.
  const { startMocks } = await import('./mocks/browser')
  await startMocks()
  const { App } = await import('./app/app')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()

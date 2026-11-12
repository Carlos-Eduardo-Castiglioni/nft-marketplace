import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Imports estáticos: o Vite emite <link rel="modulepreload"> e o navegador baixa
// app + mocks em paralelo já a partir do HTML (cadeia de requisições mais curta).
import { startMocks } from './mocks/browser'
import { App } from './app/app'

async function bootstrap() {
  // A camada de mocks é ativada por configuração (`VITE_ENABLE_MOCKS`, definida em `.env`).
  // Não há backend real: com os mocks ligados, o MSW precisa estar ativo antes da primeira requisição.
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') await startMocks()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()

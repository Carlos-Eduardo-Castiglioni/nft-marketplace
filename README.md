# Kurio — Marketplace de NFTs

Frontend do **Kurio**, um marketplace de NFTs com tema escuro e destaque cobre, baseado nas telas do Figma do desafio.
**Não existe backend real.** Toda a API REST e o Socket.IO são simulados no navegador com **MSW**, inclusive no deploy.

- **Aplicação publicada:** _adicione aqui a URL do deploy (Vercel)_
- **Arquitetura, contratos REST e eventos, sessão, cache e reconciliação:** [ARCHITECTURE.md](ARCHITECTURE.md)

## Stack

React 19 + TypeScript · Vite · TanStack Router · TanStack Query · Axios · Socket.IO client · Tailwind CSS v4 + shadcn/ui (Radix) · React Hook Form + Zod · MSW + `@mswjs/socket.io-binding` · Playwright + axe-core · Lighthouse · Vitest · ESLint

## Setup

Requisitos: Node 22+ e npm.

```bash
npm ci
npx playwright install chromium   # só para os testes E2E e o Lighthouse
npm run dev                       # http://localhost:5173 (mocks ativos)
```

A entrega roda a partir de um checkout limpo, sem serviços externos: os mocks são carregados em todos os builds, inclusive o de demonstração.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Desenvolvimento com mocks (MSW) |
| `npm run build` | Typecheck + build otimizado em `dist/` |
| `npm run preview` | Serve o build em `http://localhost:4173` |
| `npm run build:standalone` | Build com caminhos relativos e hash router em `dist-standalone/` (funciona em qualquer subpasta) |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint (TypeScript, regras de hooks) |
| `npm test` | Testes unitários (Vitest) |
| `npm run e2e` | Todos os testes Playwright (sobe o build automaticamente) |
| `npm run e2e:visual` | Só a regressão visual |
| `npm run e2e:update-snapshots` | Regera as baselines visuais da sua plataforma |
| `npm run e2e:report` | Abre o relatório HTML (`playwright-report/`), com traces das falhas |
| `npm run build && npm run lighthouse` | Auditoria Lighthouse: 3 medições por página e perfil, mediana em `lighthouse-report/summary.md` |

## Variáveis de ambiente

Nenhuma é obrigatória.

| Variável | Onde | Efeito |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `.env` (padrão `true`) | Liga a camada de mocks (MSW: REST e Socket.IO). Não há backend real, então mantenha `true` |
| `VITE_STANDALONE=1` | `.env.standalone` (usado por `npm run build:standalone`) | `base: './'` (caminhos relativos) |
| `VITE_HASH_ROUTER=1` | `.env.standalone` | Usa hash router (`/#/cart`) |
| `CI` | Playwright | Ativa retries, 2 workers e `forbidOnly` |
| `CHROME_PATH` | Lighthouse | Caminho do Chrome (padrão: o Chromium do Playwright) |

A configuração do backend simulado (latência, cenários, pagamento) fica no navegador, por URL ou `localStorage` (ver abaixo).

## Credenciais fictícias

| Usuário | E-mail | Senha | Dados iniciais |
|---|---|---|---|
| Nova Seto | `contato@email.com` | `Kurio@123` | Carteiras Principal (Ethereum) e Reserva (Polygon) |
| Rafa Lume | `rafa@email.com` | `Kurio@456` | Carteira Principal; 1 favorito |

Cupons: `KURIO10` (10%), `LAUNCH` (0.05 ETH) e `BLACK2025` (**expirado**). Qualquer outro código é **inválido**.

As senhas são guardadas com hash e salt no "banco" simulado, nunca em claro.

## Cenários do backend simulado

### Mock Lab (interface)

O botão **Mock Lab**, no canto inferior esquerdo, permite:

- **Cenário de rede por rota:** escolher a rota, o cenário e quantas vezes ele se aplica;
- **Tempo real:**
  - emitir `nft.updated` (mudança de preço);
  - derrubar o socket por 2 s;
  - **duplicar** o último evento;
  - emitir um evento com **versão antiga**;
- **Pagamento:** confirmar, recusar ou deixar pendente (manual);
- **Expirar sessão:** derruba as sessões no servidor;
- **Resetar dados:** restaura integralmente o seed e recarrega.

### Pela URL

| Parâmetro | Exemplo | Efeito |
|---|---|---|
| `mock=<rota>:<cenário>[:vezes]` | `?mock=nfts.list:server-error:3` | Falha as próximas 3 listagens |
| `payment=<confirm\|decline\|manual>` | `?payment=decline` | Resultado do pagamento |
| `jitter=<ms,ms,…>` | `?jitter=900,0,300` | Latência extra em sequência fixa (respostas fora de ordem) |
| `mockMode=inline` | `?mockMode=inline` | Força o modo sem Service Worker |

Rotas: `auth.session`, `auth.login`, `auth.register`, `nfts.list`, `nfts.detail`, `nfts.related`, `nfts.favorite`, `cart.get`, `cart.mutate`, `orders.create`, `orders.list`, `orders.get`, `profile`, `wallets`.

Cenários: `slow`, `server-error`, `bad-request`, `not-found`, `unauthorized`, `conflict`, `timeout`, `timeout-after-commit`, `network-error`.

### Pelo console ou pelos testes

```js
__kurioMock.setScenario('orders.create', 'timeout-after-commit', { times: 2 })
__kurioMock.setPayment('manual')
__kurioMock.settleOrder('<id do pedido>', 'failed')
__kurioMock.changePrice('emerald-ape-042', '1.25')
__kurioMock.changeStock('last-light-777', '1/50', 0)
__kurioMock.replayLastEvent()
__kurioMock.emitStaleNftEvent('emerald-ape-042', '0.01')
__kurioMock.pauseSockets(); __kurioMock.resumeSockets()
__kurioMock.expireSessions()
__kurioMock.reset()
```

Persistência: o banco simulado fica em `localStorage["kurio:mock-db"]`. A latência base pode ser fixada em `localStorage["kurio:mock-latency"]` (ms). O **reset** restaura o cenário conhecido.

## Como reproduzir os fluxos de falha

| Fluxo | Passos |
|---|---|
| **Preço alterado durante a compra** | Coloque um NFT no carrinho e vá ao checkout. No Mock Lab, escolha o NFT e clique em "Emitir nft.updated". O resumo é atualizado, a confirmação fica bloqueada e é preciso "Aceitar novo valor". |
| **Edição esgotada** | No console: `__kurioMock.changeStock('<nftId>', '1/50', 0)` com o item no carrinho. Aparece o aviso "A disponibilidade mudou" e o checkout fica bloqueado. |
| **Timeout depois de criar o pedido** | Mock Lab: `orders.create` → `timeout-after-commit` (2 vezes). Ao confirmar, aparece "Não conseguimos confirmar". "Tentar novamente" recupera **o mesmo** pedido (idempotência). |
| **Pagamento recusado** | Mock Lab → Pagamento → "Recusar" e confirme. A tela do pedido mostra "Pagamento recusado" e os itens continuam no carrinho. |
| **Pedido pendente + queda de conexão** | Pagamento "Manual", confirme e recarregue a página (o estado é recuperado). Clique em "Derrubar socket" e, no console, `__kurioMock.settleOrder('<id>')`. Ao reconectar, o pedido aparece confirmado e nenhuma compra nova é criada. |
| **Sessão expirada** | Logado, no checkout ou no perfil: Mock Lab → "Expirar sessão" e faça qualquer ação. O app leva ao login e, depois de entrar, volta para a tela onde você estava. |
| **5xx e retry** | `?mock=nfts.list:server-error:3`: erro com "Tentar novamente". Com `:1`, o retry automático resolve sozinho. |
| **Respostas fora de ordem** | `?jitter=1200,0` e troque filtros rapidamente: a lista sempre reflete o último filtro. |
| **Carregamento lento** | `?mock=nfts.list:slow`: skeletons com shimmer (respeita movimento reduzido). |
| **Cupom inválido ou expirado** | No carrinho: `INVALIDO` ou `BLACK2025`. |
| **Conflito de cadastro** | Cadastre-se com `contato@email.com`. |
| **Usuário errado** | Tente abrir `/orders/<id>` de outro usuário: "Pedido não encontrado". |

## Testes

- Os E2E rodam com os mocks, em Chromium, nos perfis desktop (1440×900) e mobile (390×844). A responsividade também é verificada em 768 px.
- Cada teste começa num contexto de navegador novo, com banco e sessão isolados.
- Falhas geram **trace, screenshot e vídeo**. O relatório HTML fica em `playwright-report/` (`npm run e2e:report`).

### Baselines visuais

As baselines ficam em `e2e/__screenshots__/<plataforma>/<projeto>/` e dependem do sistema operacional (fontes e antialiasing). As de Windows já estão versionadas. Para gerar as de Linux (usadas no CI):

```bash
docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.63.0-noble \
  bash -c "npm ci && npm run e2e:update-snapshots"
```

O CI só roda a etapa visual quando existem baselines Linux versionadas.

## Lighthouse

`npm run build && npm run lighthouse` sobe o `vite preview` do build otimizado (cenário padrão dos mocks) e audita início e detalhe, além de carrinho e login como referência, nos perfis mobile e desktop, **3 vezes cada**. Resultados versionados em [`lighthouse-report/`](lighthouse-report/):

- `summary.md` / `summary.json`: **mediana** de cada categoria e de LCP, CLS e TBT (com as 3 amostras no JSON);
- `environment.json`: versões (Lighthouse, Chrome, Node, Playwright, Vite), máquina e perfis de throttling;
- `runs/`: relatório HTML e JSON de cada medição.

A análise dos resultados e a justificativa do que ficou abaixo da meta estão em [ARCHITECTURE.md](ARCHITECTURE.md#12-performance-e-lighthouse).

## Deploy (Vercel)

1. Importe o repositório no Vercel. O `vercel.json` já define o framework Vite, `npm run build`, a saída `dist` e o rewrite de SPA, para que acesso direto e refresh funcionem em qualquer rota.
2. Não é preciso configurar variáveis de ambiente: o `.env` versionado já define `VITE_ENABLE_MOCKS=true`, então os mocks entram no build.
3. Depois do deploy, preencha a URL no topo deste README.

## Arquitetura (resumo)

```
src/
  app/            providers, router (rotas públicas/privadas), políticas do Query, expiração de sessão
  components/     ui/ (shadcn customizado) e layout/
  features/
    auth/         login/cadastro, sessão, limpeza de dados privados
    catalog/      home, catálogo com estado na URL, detalhe
    cart/         carrinho, cupom, alertas de preço e disponibilidade
    checkout/     pagamento, idempotência, tela do pedido/recibo
    profile/      perfil (avatar, senha), carteiras, atividade, favoritos
    realtime/     provider do Socket.IO + aplicação dos eventos no cache (EventGuard)
  lib/            http (Axios + ApiError), eth (decimal em string), contratos, query keys
  mocks/          MSW: handlers, banco, pedidos, Socket.IO, cenários, Mock Lab
e2e/              testes Playwright + baselines visuais
```

Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md).

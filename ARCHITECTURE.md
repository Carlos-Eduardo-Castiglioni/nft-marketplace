# Arquitetura — Kurio

Este documento descreve os contratos, a política de sessão, o estado do carrinho, a estratégia de cache, a reconciliação entre REST e Socket.IO, as limitações e os desvios em relação ao Figma. Setup e comandos estão no [README](README.md).

## 1. Visão geral

```
UI (React + shadcn/ui) ──► hooks TanStack Query ──► Axios (src/lib/http.ts) ──► MSW (Service Worker ou inline)
        ▲                          ▲                                               │
        │                          └──── setQueryData / invalidate ◄── socket.io-client ◄── @mswjs/socket.io-binding
        └── TanStack Router (rotas, search params, guarda de rotas privadas)
```

| Camada | Onde | Responsabilidade |
|---|---|---|
| Rotas | `src/app/router.tsx` | Rotas públicas e privadas (`beforeLoad` com a sessão), search params validados com Zod, 404 |
| Estado remoto | `src/features/*/api.ts` | `queryOptions`, mutations, invalidação e atualização otimista |
| Transporte | `src/lib/http.ts` | Axios, cabeçalhos `Authorization` e `X-Cart-Id`, normalização em `ApiError`, detecção de sessão expirada |
| Contratos | `src/lib/api-types.ts` | Tipos compartilhados entre app e mocks (uma única fonte) |
| Tempo real | `src/features/realtime/` | Conexão por sessão, deduplicação e ordenação de eventos, reconciliação |
| Backend simulado | `src/mocks/` | Handlers REST, servidor Socket.IO, "banco" persistido, cenários, Mock Lab |

Componentes, hooks e o cliente Axios **não têm respostas fictícias nem caminhos alternativos**: tudo que é simulado vive em `src/mocks/` e é interceptado na camada de rede.

## 2. Contratos REST

Base: `/api`. Respostas JSON. Erros sempre no formato `ApiErrorBody`:

```ts
{ code: string; message: string; details?: { field?: string; ... } }
```

`details.field` associa o erro a um campo do formulário (a UI marca `aria-invalid` e mostra a mensagem no campo).

### Sessão e conta

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| POST | `/auth/register` | `{ username, email, password }` | `201 Session` | `409 EMAIL_TAKEN` / `USERNAME_TAKEN` (com `field`) |
| POST | `/auth/login` | `{ email, password }` | `200 Session` | `401 INVALID_CREDENTIALS` |
| POST | `/auth/oauth/:provider` | — | `200 Session` | — |
| GET | `/auth/session` | — | `200 Session` | `401 UNAUTHORIZED` (sessão inválida ou expirada) |
| POST | `/auth/logout` | — | `204` | — |

`Session = { token, user: User }`. O login e o cadastro mesclam o carrinho do visitante (`X-Cart-Id`) no carrinho do usuário.

### Perfil e carteiras

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| GET | `/profile` | — | `User` | `401` |
| PUT | `/profile` | `Partial<User>`, `avatarUrl: string \| null`, `currentPassword`, `newPassword` | `User` | `409 EMAIL_TAKEN` / `USERNAME_TAKEN`, `422 WRONG_PASSWORD` / `SAME_PASSWORD` / `INVALID_AVATAR` |
| GET | `/wallets` | — | `Wallet[]` | `401` |
| POST | `/wallets` | `{ role, nickname, address, ensName?, network, provider }` | `201 Wallet` (substitui a carteira do mesmo papel) | `401` |
| POST | `/wallets/:id/promote` | — | `Wallet[]` | `404 WALLET_NOT_FOUND` |
| DELETE | `/wallets/:id` | — | `204` | `401` |

O avatar é uma data URL (PNG, JPEG, WebP ou GIF, até 200 KB). O cliente recorta e reduz a imagem para 128×128 antes do envio.

### NFTs e favoritos

| Método | Rota | Parâmetros | Sucesso | Erros |
|---|---|---|---|---|
| GET | `/nfts` | `q, collections, networks, minPrice, maxPrice, sort, tab, page, pageSize` | `NftListResponse` (itens, paginação e facetas) | `5xx` (cenários) |
| GET | `/nfts/:id` | — | `NftDetail` (edições com preço, estoque e limite por pedido) | `404 NFT_NOT_FOUND` |
| GET | `/nfts/:id/related` | — | `NftSummary[]` | `404` |
| GET | `/favorites` | — | `NftSummary[]` | — |
| PUT | `/nfts/:id/favorite` | `{ favorite: boolean }` | `{ id, favorite }` | `404` |

Todo `NftSummary` traz `version`, que cresce a cada mudança de preço ou estoque. É a mesma versão enviada nos eventos.

### Carrinho e cotação

O carrinho **é a cotação**: toda resposta traz subtotal, desconto, taxa de rede, total e as flags de preço e disponibilidade, calculados no servidor.

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| GET | `/cart` | — | `Cart` | — |
| POST | `/cart/items` | `{ nftId, editionId, quantity }` | `Cart` | `404`, `422 INVALID_QUANTITY` / `QUANTITY_LIMIT` |
| PATCH | `/cart/items/:lineId` | `{ quantity }` | `Cart` | `404 LINE_NOT_FOUND`, `422 QUANTITY_LIMIT` |
| DELETE | `/cart/items/:lineId` | — | `Cart` | — |
| POST | `/cart/coupon` | `{ code }` | `Cart` | `422 INVALID_COUPON` / `COUPON_EXPIRED` |
| DELETE | `/cart/coupon` | — | `Cart` | — |
| POST | `/cart/accept-prices` | — | `Cart` (trava os preços vigentes) | — |

`CartLine` traz `unitPrice` (preço travado), `currentPrice` (preço vigente), `stock`, `maxPerOrder` e `priceChanged`. `Cart.version` cresce a cada mudança.

### Pedidos

| Método | Rota | Corpo / cabeçalhos | Sucesso | Erros |
|---|---|---|---|---|
| POST | `/orders` | `Idempotency-Key`; `{ cartVersion, walletId, provider, total }` | `201 Order` (pending), ou `200` + `Idempotent-Replayed: true` ao repetir | `400 IDEMPOTENCY_KEY_REQUIRED`, `409 IDEMPOTENCY_CONFLICT` / `ORDER_PENDING` / `CART_VERSION_MISMATCH` / `PRICE_CHANGED` / `OUT_OF_STOCK` / `QUOTE_CHANGED`, `422 EMPTY_CART` / `WALLET_REQUIRED` |
| GET | `/orders` | — | `Order[]` do usuário | `401` |
| GET | `/orders/:id` | — | `Order` | `403 FORBIDDEN` (pedido de outro usuário), `404 ORDER_NOT_FOUND` |

O `Order` é um **snapshot**: linhas, cupom, subtotal, desconto, taxa e total ficam congelados na criação. Mudanças posteriores no catálogo não alteram o recibo.

### Erros transversais

| Situação | Resposta |
|---|---|
| Validação | `422` com `details.field` |
| Sessão inválida ou expirada | `401 UNAUTHORIZED` |
| Falta de permissão | `403 FORBIDDEN` |
| Recurso inexistente | `404 *_NOT_FOUND` |
| Conflito de disponibilidade, versão ou idempotência | `409` |
| Falha transitória | `5xx`, timeout ou erro de rede (via cenários) |

## 3. Eventos Socket.IO

Transporte: `socket.io-client` com `transports: ['websocket']` para `wss://realtime.kurio.mock`, interceptado pelo MSW (`ws.link`) e convertido para o protocolo Socket.IO por `@mswjs/socket.io-binding`. O token da sessão vai no handshake (`?token=`).

```ts
interface NftUpdatedEvent {   // público (broadcast)
  eventId: string             // identidade estável
  id: string                  // NFT afetado
  version: number             // versão do NFT após a mudança
  editionId?: EditionId
  price?: EthString           // novo preço base
  stock?: number
  at: string
}

interface OrderUpdatedEvent { // privado: só para as conexões do dono
  eventId: string
  id: string                  // pedido afetado
  version: number             // 1 = pending, 2 = terminal
  userId: string
  status: 'pending' | 'confirmed' | 'failed'
  failureReason?: string
  at: string
}
```

Garantias no cliente (`src/features/realtime/events.ts`, classe `EventGuard`):

- **Duplicatas:** um `eventId` já visto é descartado e não reaplica efeitos nem toasts.
- **Eventos antigos:** um evento com `version` menor ou igual à última conhecida é descartado. A "última conhecida" também considera o que veio do REST (cache), então um evento atrasado não regride um dado mais novo.
- **Terminais:** `confirmed` e `failed` nunca voltam para `pending`.
- **Isolamento:** o servidor só entrega `order.updated` às conexões do dono. O cliente ainda descarta eventos cujo `userId` não seja o da sessão atual.
- **Ciclo de vida:** há um socket por sessão. Login, logout e troca de usuário encerram a conexão anterior (`removeAllListeners` + `disconnect`) e abrem uma nova.

## 4. Sessão

- O token fica no `localStorage` (`kurio:token`). Ao abrir a página, `GET /auth/session` recupera a sessão.
- Rotas privadas (`/checkout`, `/orders/$orderId`, `/profile/*`) exigem sessão em `beforeLoad`. Sem sessão, a navegação vai para `/login?redirect=<rota>` e, depois do login, volta para a rota original.
- **Expiração:** qualquer requisição autenticada que volte `401` derruba o token (interceptor do Axios). Em seguida a aplicação limpa os dados privados do cache e, se a tela é privada, leva ao login com `redirect`. O carrinho do usuário fica no servidor, e a chave de idempotência continua no `sessionStorage`, então o checkout é retomado exatamente de onde parou.
- **Logout e troca de usuário:** `clearPrivateData` remove do cache pedidos, carteiras, perfil, favoritos e carrinho, e invalida as listas de NFTs (que carregam o flag `favorite`). O logout também gera um novo carrinho anônimo, e o socket é recriado.
- **Senhas:** nunca ficam em claro. O mock guarda `sha256(salt:senha)` com um salt por usuário (`src/mocks/password.ts`). Um backend real usaria um KDF lento (argon2, bcrypt ou scrypt).

## 5. Carrinho

- **Visitante:** carrinho anônimo identificado por `X-Cart-Id` (gerado no navegador).
- **Autenticado:** carrinho do usuário (`user:<id>`) no servidor.
- **Ao autenticar:** os itens do visitante são mesclados no carrinho do usuário, respeitando estoque e limite por pedido.
- **Ao sair:** um novo carrinho anônimo vazio. Os itens continuam com o usuário e voltam no próximo login.
- **Valores:** ETH trafega como string decimal e as contas usam `bigint` em wei (`src/lib/eth.ts`). Quantidades são inteiras. O total vem do servidor; o cálculo local serve só para a atualização otimista da quantidade.
- **Tempo real:** `nft.updated` invalida o carrinho. A linha com preço novo fica marcada (`priceChanged`) e a confirmação é bloqueada até o usuário aceitar o novo valor. Uma linha com quantidade maior que o estoque mostra o aviso de disponibilidade e também bloqueia o checkout.

## 6. Pedidos e idempotência

```
POST /orders ──► pending ──(liquidação simulada)──► confirmed | failed     (terminais)
```

- **Chave de idempotência:** derivada da intenção (`cartVersion | carteira | provedor | total`) e guardada no `sessionStorage`. É a mesma chave em retries automáticos, no botão "Tentar novamente" e depois de um refresh.
- **No servidor:**
  - mesma chave e mesmo conteúdo devolvem o mesmo pedido;
  - mesma chave com outro conteúdo devolve `409 IDEMPOTENCY_CONFLICT`;
  - um segundo pedido para um carrinho que já tem pedido pendente devolve `409 ORDER_PENDING`.
- **Clique repetido:** uma trava síncrona (`useRef`) impede o reenvio enquanto a tentativa está em voo.
- **Revalidação antes de criar:** versão do carrinho, preços, estoque e total cotado. Qualquer diferença exige nova confirmação do usuário.
- **Liquidação:** o horário (`settleAt`) fica no banco persistido. Se a página recarrega com o pedido pendente, a liquidação é reagendada no boot.
- **Confirmed:** baixa o estoque, emite `nft.updated` e remove do carrinho **apenas** os itens e quantidades comprados.
- **Failed:** nada muda; os itens continuam no carrinho.
- **Tela `/orders/$orderId`:** funciona por acesso direto e após refresh. Mostra "aguardando" (pendente), "pagamento recusado" com o motivo, ou o recibo, que só aparece para pedido confirmado. Enquanto o pedido está pendente, além do `order.updated` há uma consulta REST a cada 5 s como fallback.

## 7. Estratégia de cache (TanStack Query)

| Query | staleTime | Observações |
|---|---|---|
| `session` | ∞ | Definida no login e no logout; derrubada em 401 |
| `nfts.list` | 30 s | `keepPreviousData` na paginação; o patch de preço via evento é direto no cache |
| `nfts.detail` / `related` | 60 s | Invalidados por `nft.updated` |
| `cart` | 0 | Sempre revalida; a fonte da verdade é o REST |
| `orders` / `orders.detail` | 10 s | Atualizados por `order.updated`; o detalhe pendente consulta a cada 5 s |
| `profile` / `wallets` / `favorites` | 60 s | Removidos no logout e na troca de usuário |

- **Chaves:** as listas são chaveadas pelos parâmetros de busca (`qk.nfts.list(search)`). Os dados privados são removidos a cada troca de sessão, então nunca são servidos para outro usuário.
- **Respostas obsoletas:** todo `queryFn` repassa o `signal` ao Axios. Mudar filtros cancela a requisição anterior, e o TanStack Query só aplica a resposta da chave atual, o que protege contra respostas fora de ordem.
- **Retry:** até 2 tentativas com backoff exponencial, só para falhas transitórias (timeout, rede, 5xx). Erros 4xx nunca são repetidos. Mutations não têm retry automático, exceto o pedido, que repete uma vez com a mesma chave de idempotência.
- **Atualização otimista com rollback:** favoritos, quantidade no carrinho e promoção de carteira.
- **Erros:** um erro em background (quando já havia dado em tela) vira toast. Erros de mutation aparecem no campo (`details.field`) ou em toast.

## 8. Reconciliação REST × Socket.IO

1. O REST é a fonte da verdade, e os eventos são uma otimização de latência.
2. Ao reconectar, o cliente invalida NFTs, carrinho e pedidos, e recupera o que mudou durante a queda (teste "após reconexão, dados perdidos são reconciliados").
3. A versão de cada recurso compara o REST com os eventos, então um evento atrasado não sobrescreve um dado mais novo.
4. Eventos de pedido só chegam ao dono, e a conexão é refeita a cada troca de sessão.

## 9. Mocks (MSW)

- **Ativação:** a camada de mocks é ligada pela variável `VITE_ENABLE_MOCKS` (`.env` versionado, padrão `true`), que vale para dev, para o build de demonstração (deploy), para os testes e para o Lighthouse. `src/main.tsx` só chama `startMocks()` quando a flag não é `false`. Componentes, hooks e o cliente Axios não sabem se estão falando com o mock.
- **REST:** os handlers ficam em `src/mocks/handlers/` e o "banco" em `src/mocks/db.ts`, persistido em `localStorage` com chave e versão de schema. `__kurioMock.reset()` (ou "Resetar dados" no Mock Lab) restaura o seed por completo.
- **Fixtures:** 72 NFTs determinísticos (PRNG com seed fixa), 9 coleções, 3 redes, itens para precisão decimal e para estoque baixo, e **dois usuários** com carteiras e favoritos.
- **Cenários:**
  - por rota: `ok`, `slow`, `server-error`, `bad-request`, `not-found`, `unauthorized`, `conflict`, `timeout`, `timeout-after-commit` (o servidor efetiva e a resposta se perde) e `network-error`;
  - latência variável determinística (`jitter`);
  - resultado do pagamento (`confirm`, `decline` ou `manual`);
  - expiração de sessão;
  - eventos duplicados e antigos;
  - queda do socket.
- **Modos:**
  - **Service Worker (padrão):** intercepta REST e WebSocket.
  - **Inline (fallback, ou `?mockMode=inline`):** quando o Service Worker não pode ser registrado. O MSW intercepta `fetch`/XHR na página, e o WebSocket é interceptado direto com `@mswjs/interceptors`.

### Limitações do transporte simulado

- **Ciclo de vida do servidor:** ele roda **dentro da página**. Um refresh reinicia o "servidor" (conexões, temporizadores, cenários ativos), mas o banco persiste, e liquidações pendentes são reagendadas pelo `settleAt` gravado.
- **Escopo por aba:** cada aba tem seu próprio servidor simulado. Eventos não atravessam abas, só o estado persistido é compartilhado.
- **Transporte:** apenas WebSocket. O long-polling do Engine.IO não é simulado.
- **Heartbeat:** o ping do Engine.IO é enviado a cada 20 s pelo servidor simulado.

## 10. Testes

- **Vitest:** aritmética ETH, totais e cupons, schema da URL, schemas de auth, idempotência, hash de senha e `EventGuard`.
- **Playwright** (Chromium, desktop 1440 e mobile 390):
  - **Compra:** jornada completa, idempotência com timeout depois do commit, pagamento recusado, clique repetido, pedido pendente com refresh e queda do socket, remoção parcial do carrinho, recibo de outro usuário.
  - **Sessão:** carrinho do visitante preservado no login, troca de usuário sem vazamento, evento de sessão anterior, expiração no checkout e na navegação.
  - **Perfil:** dados, avatar e senha com erros da API.
  - **Tempo real:** eventos duplicados e antigos, estoque via socket.
  - **Responsividade:** 390, 768 e 1440 px, e zoom de 200 %.
  - **Regressão visual:** início, detalhe, carrinho e pagamento.
  - **Acessibilidade:** axe e teclado.
- **Isolamento:** cada teste roda num contexto novo do navegador (`localStorage` e banco do mock próprios). A latência é fixada em 40 ms. O relógio é fixo na regressão visual. Eventos e liquidação são disparados pelos testes via `__kurioMock`, passando pelo `socket.io-client` e pelos handlers MSW.
- **Baselines visuais:** dependem da plataforma (fontes e antialiasing) e ficam em `e2e/__screenshots__/<plataforma>/`. O CI só roda a etapa visual quando existem baselines Linux versionadas (ver README).

## 11. Decisões de UX, limitações e desvios do Figma

- **Confirmação como página:** no Figma ela é um modal ("Thank you"). Virou a rota `/orders/$orderId` para funcionar com acesso direto e refresh e para representar os estados pendente e recusado, que não estão desenhados. O conteúdo do recibo segue o modal.
- **Explorador simulado:** "Ver no Etherscan" virou "Ver no explorador (simulado)" e abre um diálogo interno, porque o hash é fictício e um link real levaria a uma página inexistente.
- **Estados não desenhados:** pendente, recusado, edição esgotada no carrinho, sessão expirada e reconexão seguem os padrões visuais existentes (Alert, Badge, cores de aviso).
- **Avatar:** o upload é funcional. A imagem é reduzida a 128 px e salva no perfil simulado.
- **Ações fora do escopo:** Ofertas, Arquivos baixados e Suporte mostram "em breve" e não simulam sucesso.
- **Carrinho durante pedido pendente:** o usuário pode continuar navegando e adicionando itens, mas não cria outro pedido para o mesmo carrinho até o atual terminar.
- **Imagens:** os assets do Figma estão em `public/nfts/` (servidos localmente) e as fontes vêm via `@fontsource` (sem CDN).

## 12. Performance e Lighthouse

**Como foi medido:** `npm run build && npm run lighthouse` (script versionado em [`scripts/lighthouse.mjs`](scripts/lighthouse.mjs)). O script audita o build de produção servido por `vite preview`, com o cenário padrão dos mocks e sem nenhuma simplificação exclusiva para a auditoria: as imagens, as fontes, o MSW e o Socket.IO simulado são carregados normalmente. Cada página é medida **3 vezes por perfil** e o resultado reportado é a **mediana**. Os relatórios HTML e JSON de cada medição, `summary.md`/`summary.json` e `environment.json` (versões: Lighthouse 13.6.0, HeadlessChrome 153, Node 24, Playwright 1.63, Vite 7.3; máquina e perfis de throttling) estão em [`lighthouse-report/`](lighthouse-report/).

**Perfis:** mobile usa o padrão do Lighthouse (Moto G Power emulado, Slow 4G simulado, CPU 4x mais lenta). Desktop usa 1350×940, 40 ms de RTT, 10 Mbps e CPU sem desaceleração.

### Resultados (mediana de 3)

| Perfil | Página | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| mobile | Início `/` | **82** | 97 | 100 | 92 | 3,6 s | 0,001 | 241 ms |
| mobile | Detalhe `/nft/emerald-ape-042` | **83** | 100 | 100 | 92 | 3,9 s | 0 | 247 ms |
| desktop | Início `/` | 100 | 97 | 100 | 92 | 0,8 s | 0,001 | 0 ms |
| desktop | Detalhe `/nft/emerald-ape-042` | 99 | 97 | 100 | 92 | 0,9 s | 0 | 0 ms |

Carrinho e login também são auditados como referência (ver `summary.md`). Todas as metas são atingidas, **exceto a Performance no mobile** (82 e 83, meta ≥ 90).

### Por que a Performance mobile ficou abaixo de 90

O que puxa a nota para baixo é o **LCP** (3,6 a 3,9 s). CLS e TBT estão bons. O detalhamento do LCP no próprio relatório mostra que o problema não está na rede:

- A imagem LCP (`nfts/emerald-640.webp`, 30 KB, com `preload` e `fetchpriority="high"`) termina de baixar em cerca de 5 ms (TTFB de cerca de 4 ms). Quase todo o tempo cai em **element render delay**: a imagem já está disponível, mas só é pintada quando o React renderiza o componente.
- O render depende de três passos em série, e todos são parte da entrega:
  1. **Avaliar o JS principal** (321 KB transferidos, cerca de 0,8 s de scripting na CPU 4x lenta). Esse chunk inclui o MSW, o banco simulado, as fixtures e o servidor Socket.IO simulado, que precisam estar ativos antes da primeira requisição.
  2. **Iniciar o MSW** (registro do Service Worker) antes do `createRoot`.
  3. **Esperar a resposta simulada da API** (`/api/nfts`, `/api/nfts/:id`), que tem uma latência artificial de cerca de 250 ms para o cenário padrão parecer uma rede real.
- No desktop (CPU sem desaceleração) a mesma cadeia leva menos de 1 s, e a nota fica entre 99 e 100.

As causas são estruturais: é uma SPA sem SSR, e o "backend" roda no próprio navegador. Em produção, com uma API real, os passos 1 e 2 sairiam do caminho crítico (o código de mock não seria enviado ao cliente), e o LCP ficaria limitado ao bundle da aplicação e ao tempo de resposta da API. Não removemos a latência simulada nem os mocks só para melhorar a nota, porque o enunciado proíbe simplificações exclusivas para a auditoria.

**O que já foi feito:** `preload` e `fetchpriority` na imagem LCP; imagens WebP em 320 e 640 px com `width`/`height` (CLS ≈ 0); fontes locais via `@fontsource` (sem CDN); rotas carregadas sob demanda (`lazyRouteComponent`); chunks separados para React e TanStack; Mock Lab carregado sob demanda.

**Próximos passos possíveis:** pré-renderizar (SSG) o esqueleto do início e do detalhe para que a imagem LCP seja pintada antes do JS; mover o banco simulado e as fixtures para um chunk carregado em paralelo ao app; usar uma latência simulada menor só na primeira carga (isso mudaria o comportamento da demonstração, por isso não foi adotado).

**Variação:** as notas mobile dependem da CPU da máquina, porque o throttling é simulado. Em uma medição anterior (1 amostra, antes desta série) o início mobile marcou 60. A mediana de 3 amostras reduz esse ruído, mas os valores podem variar alguns pontos entre máquinas.

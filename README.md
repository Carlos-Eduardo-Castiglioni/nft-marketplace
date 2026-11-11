# Kurio — Marketplace de NFTs

Frontend do **Kurio**, um marketplace de NFTs com tema escuro e destaque cobre, baseado nas telas do Figma do desafio.
**Não existe backend real.** Toda a API REST e o Socket.IO são simulados no navegador com **MSW**.

## Como rodar

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # testes unitários (Vitest)
npm run e2e          # testes E2E (Playwright: desktop + mobile)
npm run build && npm run lighthouse   # auditoria Lighthouse (gera lighthouse-report/)
npm run build:standalone   # build estático com hash router (funciona em qualquer subpasta, sem Service Worker)
```

**Conta de demonstração:** `contato@email.com` / `Kurio@123` (já vem com as carteiras Principal e Reserva).
Cupons: `KURIO10` (10%) e `LAUNCH` (0.05 ETH).

O botão **Mock Lab**, no canto inferior esquerdo, faz três coisas: injeta falhas (500, 404, timeout, `timeout-after-commit` e outras), dispara `nft.updated` e derruba a conexão do socket para testar a reconexão.

## Stack

React 19 + TypeScript · Vite · TanStack Router · TanStack Query · Axios · Socket.IO client · Tailwind CSS v4 + primitivas shadcn/ui (Radix) · React Hook Form + Zod · MSW + `@mswjs/socket.io-binding` · Playwright + axe-core · Lighthouse · Vitest

## Arquitetura (Feature-Sliced)

```
src/
  app/            setup global: providers, router (rotas públicas/privadas), políticas do Query
  components/
    ui/           primitivas shadcn customizadas (button, dialog/sheet, select, slider, skeleton…)
    layout/       header, footer, bottom-nav mobile, páginas de status
  features/
    auth/         login/cadastro (modal + página), sessão, schemas Zod
    catalog/      home/hero, catálogo com filtros na URL, card, detalhe, carrossel
    cart/         carrinho (tabela desktop / cards mobile), cupom, totais, alerta de preço
    checkout/     pagamento, idempotência, modal de sucesso
    profile/      dados do perfil, carteiras (principal/reserva), atividade, favoritos
    realtime/     provider do Socket.IO + aplicação de eventos no cache
  lib/            http (Axios + ApiError), eth (decimal em string), cart-math, query keys
  mocks/          MSW: handlers REST, servidor Socket.IO, cenários de falha, fixtures, Mock Lab
e2e/              testes Playwright
```

## Decisões principais

- **ETH como string decimal.** Os valores trafegam sempre como `string` (ex.: `"1.19"`). Os cálculos usam `bigint` em wei (18 casas) em `src/lib/eth.ts`, então `0.1 + 0.2 = 0.3` exatamente. O mesmo código calcula os totais no "servidor" (MSW) e no cliente (atualização otimista).
- **Estado na URL.** Busca, coleções, rede, faixa de preço, aba, ordenação e página ficam nos search params do TanStack Router, validados com Zod e com fallback para valores inválidos. Refresh e voltar/avançar mantêm o estado.
- **Políticas de cache.** Estão documentadas em `src/app/query-client.ts`: `staleTime` por tipo de dado, `keepPreviousData` na paginação e retry só para erros transitórios (timeout, rede, 5xx).
- **Idempotência no checkout.** O `POST /api/orders` envia `Idempotency-Key`. A chave é derivada da intenção de compra (versão do carrinho + carteira + provedor) e fica salva no `sessionStorage`. Timeouts são re-tentados automaticamente com a mesma chave, e o botão "Tentar novamente" também usa essa chave. O mock devolve o pedido já criado em vez de duplicar.
- **Tempo real.** O evento `nft.updated` atualiza o preço nas listas e invalida o detalhe e o carrinho. O servidor marca a linha com `priceChanged`, a confirmação fica bloqueada e o usuário precisa clicar em "Aceitar novo valor". O servidor também recusa o pedido com `409 PRICE_CHANGED`. O evento `order.updated` confirma a transação no modal.
- **Reconexão.** Ao reconectar, o app invalida NFTs, carrinho e pedidos e reconcilia com o REST os eventos perdidos durante a queda.
- **CLS ≈ 0.** Os skeletons com shimmer têm as mesmas dimensões dos componentes reais, as imagens têm `width`/`height` e o `main` tem altura mínima.
- **Acessibilidade.** Os modais (Radix) prendem o foco, fecham com Esc e devolvem o foco. Há skip link, labels e `aria-*` ligados por `Field`, spinbutton com teclado e radio de edição com setas. O axe roda nos testes E2E.

## Cenários de falha (MSW)

Pela URL: `?mock=<rota>:<cenário>[:vezes]` (ex.: `?mock=nfts.list:server-error:3`).
Pelo console ou pelos testes: `window.__kurioMock.setScenario('orders.create', 'timeout-after-commit', { times: 2 })`.

Cenários: `slow`, `server-error`, `bad-request`, `not-found`, `unauthorized`, `conflict`, `timeout`, `timeout-after-commit`, `network-error`.

## Modos do backend simulado

- **Service Worker (padrão):** o MSW intercepta as requisições do Axios.
- **Inline (fallback):** quando o Service Worker não pode ser registrado (iframe, WebView, aba privada) ou com `?mockMode=inline`, o MSW intercepta `fetch`/XHR na própria página e o WebSocket é interceptado com `@mswjs/interceptors`.

## Testes

- **Unitários (Vitest):** aritmética ETH, totais/cupons, schema da URL, schemas de auth, idempotência.
- **E2E (Playwright):**
  - jornada **Filtros → Carrinho → Mudança de preço via Socket → Checkout → Recuperação de falha**, sem pedido duplicado;
  - filtros/URL/refresh, paginação e faixa de preço;
  - limites de quantidade e precisão decimal;
  - 5xx com retry, skeletons, 404, favorito otimista com rollback;
  - reconexão de socket com reconciliação;
  - rotas privadas, cadastro/login com Zod, carteiras;
  - axe em 6 páginas e navegação por teclado nos modais;
  - fluxo mobile com drawer de filtros.

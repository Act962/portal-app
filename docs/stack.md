# Stack Tecnológica — Portal de Notícias

> **Status:** Aprovado em 03/08/2026 — **decisões 1 a 6 fechadas**.
> Único item em aberto: o **provedor de produção** (Decisão 4), adiado a pedido do time. O
> desenvolvimento roda 100% em Docker local, então isso não bloqueia nenhuma fase até o go-live.
> **Fase:** 1 (Planejamento). Nenhuma dependência será instalada antes do início da Fase 0.

---

## 1. Princípios que guiam as escolhas

Toda decisão abaixo foi tomada (ou proposta) sob quatro critérios, nesta ordem:

1. **Sustentabilidade a longo prazo** — preferir tecnologia madura, com comunidade grande e
   documentação sólida, a tecnologia "da moda". Trocar o banco de dados em 3 anos custa caro;
   trocar uma biblioteca de UI, não.
2. **Testabilidade de primeira classe** — a stack precisa permitir testar regra de negócio
   **sem** subir banco, sem subir servidor e sem browser. Isso é consequência direta da
   arquitetura DDD (ver `architecture.md`), mas a stack não pode atrapalhar.
3. **Baixo atrito de onboarding** — um dev novo deve conseguir rodar o projeto com
   `pnpm install && pnpm dev`. Uma única linguagem (TypeScript) do banco ao browser reduz
   drasticamente a curva de aprendizado.
4. **Escala de leitura** — portal de notícias tem perfil **99% leitura / 1% escrita**, com
   picos imprevisíveis (notícia viral). A arquitetura de cache importa mais que a linguagem.

---

## 2. Estado atual do repositório

O repositório já foi scaffolded com o [Better-T-Stack](https://better-t-stack.dev). O que já existe:

| Item | Estado atual |
|---|---|
| Monorepo | Turborepo + pnpm workspaces (`apps/*`, `packages/*`) |
| Frontend | Next.js 16 (App Router), React 19, React Compiler ativo |
| Estilo | Tailwind CSS v4 + shadcn/ui em `packages/ui` |
| API | tRPC 11 (`packages/api`) |
| ORM | Prisma 6.19 (`packages/db`) |
| Banco | **MongoDB** (via Docker Compose) |
| Auth | Better-Auth 1.6 (`packages/auth`), e-mail/senha |
| Lint/Format | Biome 2.5 |
| Env | `@t3-oss/env-*` + Zod (`packages/env`) |
| Testes | **Nenhum** — não há runner nem teste configurado |

**Conclusão:** a base do monorepo é boa e será mantida. Os pontos que precisam de decisão são
**banco de dados, busca, mídia, infraestrutura e testes**.

---

## 3. Stack proposta — visão geral

| Camada | Escolha proposta | Status |
|---|---|---|
| Linguagem | TypeScript 6 (strict) | ✅ Definido |
| Monorepo | Turborepo + pnpm | ✅ Mantido |
| Frontend | Next.js 16 App Router + React 19 (RSC) | ✅ Mantido |
| Estilo / DS | Tailwind v4 + shadcn/ui (`packages/ui`) | ✅ Mantido |
| API interna | tRPC 11 (painel admin) | ✅ Mantido |
| API pública | Route Handlers REST (feeds, sitemaps, webhooks) | ✅ Definido |
| ORM | Prisma 6 | ✅ Mantido |
| **Banco de dados** | **PostgreSQL 17** (migração a partir do MongoDB do scaffold) | ✅ **Decisão 1** |
| Cache | Redis (Upstash) + ISR/CDN do Next.js | ✅ Definido |
| **Busca** | **Postgres full-text no MVP** → Meilisearch na Fase 5 | ✅ **Decisão 2** |
| Auth | Better-Auth + RBAC próprio | ✅ Mantido |
| **Mídia / CDN** | **Cloudflare R2** (compatível com S3, egress gratuito) | ✅ **Decisão 3** |
| **Ambiente de desenvolvimento** | **Docker Compose** (Postgres + Redis + Inngest dev) | ✅ **Decisão 4a** |
| **Infra de produção** | Inclinação: híbrido (Vercel + Postgres gerenciado) | 🕓 **Decisão 4b** — adiada |
| **Editor de texto** | **TipTap** — conteúdo em blocos JSON | ✅ **Decisão 5** |
| **Jobs e eventos em background** | **Inngest** (agendamento, outbox, fan-out) | ✅ **Decisão 6** |
| Testes unit/integração | Vitest + Testing Library | ✅ Definido |
| Testes de integração (DB) | Testcontainers | ✅ Definido |
| Testes E2E | Playwright | ✅ Definido |
| CI/CD | GitHub Actions + cache remoto do Turborepo | ✅ Definido |
| Observabilidade | Sentry + OpenTelemetry | ✅ Definido |
| Validação | Zod 4 (fronteiras: HTTP, env, formulários) | ✅ Mantido |
| Formulários | TanStack Form (já no `apps/web`) | ✅ Mantido |
| Data fetching (admin) | TanStack Query + tRPC | ✅ Mantido |

---

## 4. Justificativas por camada

### 4.1 Linguagem e monorepo — TypeScript + Turborepo/pnpm

**Por quê:** uma linguagem só em todo o stack permite compartilhar **tipos de domínio** entre
banco, API e UI sem duplicação nem geração de código intermediária. O monorepo é essencial para
DDD: cada *bounded context* vira um pacote com fronteiras explícitas, e a ferramenta (`pnpm`)
**impede** import indevido entre contextos que não declararam dependência — a arquitetura passa a
ser garantida pelo build, não por disciplina.

O Turborepo dá cache de tarefas (local e remoto): no CI, só é reexecutado o que mudou. Em um
projeto de anos, isso é a diferença entre um CI de 2 e de 15 minutos.

**Alternativa descartada:** Nx (mais poderoso, porém mais complexo e opinativo — não compensa aqui).

### 4.2 Frontend — Next.js 16 (App Router) + React Server Components

**Por quê:** um portal de notícias vive de três coisas que o Next.js resolve nativamente:

- **SEO e HTML no servidor.** Google News/Discover precisa do conteúdo no HTML inicial.
- **ISR (Incremental Static Regeneration).** Uma matéria publicada é renderizada uma vez e
  servida do CDN para milhões de leitores. Quando editada, invalida-se apenas aquela rota
  (`revalidateTag`). É o mecanismo que sustenta o pico de tráfego de uma notícia viral.
- **RSC.** O portal público envia quase nenhum JavaScript ao browser (bom para Core Web Vitals),
  enquanto o painel admin — que precisa de interatividade — usa Client Components normalmente.

**Trade-off assumido:** acoplamento ao ecossistema Next/Vercel. Mitigado mantendo a regra de
negócio fora do framework (DDD), de forma que o Next.js seja apenas uma camada de entrega
substituível.

### 4.3 API — tRPC (interno) + REST (externo)

**Por quê a divisão:**

- **tRPC** para tudo que o **painel administrativo** consome: tipagem ponta a ponta sem
  code-gen, refactor seguro, e o compilador acusa quebra de contrato entre back e front.
  Como cliente e servidor moram no mesmo monorepo, é o melhor custo-benefício possível.
- **REST (Route Handlers)** para o que precisa ser consumido por **terceiros**: RSS, sitemaps,
  `news-sitemap.xml`, webhooks, futuros apps mobile ou parceiros. tRPC não serve bem esse caso
  (contrato acoplado ao TypeScript).

O portal público, por ser RSC, **não chama API**: os Server Components consultam a camada de
aplicação diretamente, eliminando um salto de rede.

### 4.4 Cache — Redis + ISR

Três níveis, do mais barato ao mais caro:

1. **CDN / ISR** — HTML pronto das páginas públicas. Absorve a esmagadora maioria do tráfego.
2. **Redis** — dados compartilhados entre instâncias: "mais lidas", contadores de visualização,
   rate limiting, sessões, cache de queries pesadas da home.
3. **Banco** — só é atingido em cache miss ou escrita.

Sem Redis, "mais lidas" viraria um `COUNT` no banco a cada request — o primeiro gargalo real
de um portal.

### 4.5 Autenticação — Better-Auth

Já configurado. **Por quê manter:** é TypeScript-first, roda no nosso próprio banco (sem
vendor lock-in de identidade), suporta e-mail/senha, OAuth, 2FA e *organizations* via plugins, e
o modelo de dados é nosso.

**Importante:** Better-Auth cuida de **autenticação** (quem é você). A **autorização** (o que
você pode fazer) — papéis admin/editor/redator e regras como "redator só edita o próprio
rascunho" — é **regra de negócio** e ficará no contexto *Identidade & Acesso* do domínio, não na
biblioteca. Isso a torna testável sem HTTP.

### 4.6 Testes — Vitest + Testcontainers + Playwright

- **Vitest** — mesmo motor do bundler (Vite), execução em milissegundos, API compatível com Jest,
  suporte nativo a TS/ESM e *workspaces* (essencial no monorepo). Roda os testes de domínio e de
  aplicação em memória, sem infraestrutura.
- **Testcontainers** — sobe Postgres/Redis/Meilisearch reais e efêmeros em Docker para os testes
  de integração dos repositórios. Testar repositório contra mock é ilusão de cobertura; contra
  container real, o teste vale.
- **Playwright** — E2E multi-browser, com *tracing* e paralelismo. Cobre os fluxos críticos:
  publicar notícia, ler notícia, buscar, moderar comentário.

Detalhamento completo em `testing-strategy.md`.

### 4.7 Jobs e eventos — Inngest

Um portal tem muito trabalho que não pode acontecer dentro do request do usuário: publicar a
matéria agendada às 6h, reindexar a busca, invalidar o cache do CDN, disparar newsletter.

O Inngest cobre isso com **funções duráveis**: cada função é dividida em passos (`step.run`), e
cada passo tem seu resultado persistido. Se o terceiro passo falhar, o retry recomeça dali — não do
início. Isso elimina a categoria de bug mais desagradável desse tipo de código: o efeito colateral
executado duas vezes (matéria publicada duas vezes, e-mail enviado em duplicidade).

Detalhes e alternativas avaliadas na **Decisão 6**, seção 5.

### 4.8 CI/CD — GitHub Actions

Jobs paralelos (lint → typecheck → unit → integração → e2e → build) com cache remoto do Turborepo.
Preview deploy por Pull Request. Nenhum merge em `main` sem CI verde.

### 4.9 Observabilidade — Sentry + OpenTelemetry

Erro em produção sem rastreamento custa horas. Sentry para exceções e *session replay* do admin;
OpenTelemetry para tracing distribuído (útil quando o portal crescer). Métricas de negócio
(publicações/dia, tempo de leitura) ficam no contexto *Analytics*, não no APM.

---

## 5. Decisões tomadas

As tabelas de trade-off abaixo foram mantidas de propósito, mesmo após a decisão: em um projeto de
anos, saber **o que foi descartado e por quê** vale tanto quanto saber o que foi escolhido. Cada
decisão termina com o veredito.

### Decisão 1 — Banco de dados: PostgreSQL ou MongoDB?

| | **PostgreSQL 17** (recomendado) | **MongoDB** (atual) |
|---|---|---|
| Relacionamentos | Nativo. Notícia↔tags (N:N), editorias hierárquicas, comentários em árvore, papéis | Exige desnormalização ou `$lookup` manual |
| Integridade | Constraints, FKs e transações ACID garantem invariantes no banco | Garantia só na aplicação |
| Busca | Full-text nativo (`tsvector`) — pode dispensar motor externo no MVP | Atlas Search só na nuvem paga |
| Analytics/relatórios | SQL, window functions, agregações complexas | Aggregation pipeline mais verboso |
| DDD | Transação por agregado é direta | *Outbox* e consistência exigem cuidado extra |
| Custo de mudança | **Migrar o scaffold**: trocar provider do Prisma, adapter do Better-Auth, `_id`→`id` | **Zero** — já está pronto |
| Ecossistema | Neon, Supabase, RDS, ou Docker | Atlas ou Docker |

✅ **Decidido: PostgreSQL** (03/08/2026). O conteúdo de um portal é altamente relacional (matéria →
autor → editoria → tags → mídia → comentários) e o projeto é de longo prazo. O retrabalho agora é
de poucas horas — o scaffold quase não tem código ainda; daqui a um ano seria de semanas.
O único caso em que MongoDB venceria é se o conteúdo fosse radicalmente heterogêneo e sem
relatórios — não é o caso.

**Impacto operacional da migração** (executada na Fase 0 do roadmap):

- `packages/db/prisma/schema/schema.prisma`: `provider = "mongodb"` → `"postgresql"`
- `packages/auth/src/index.ts`: `prismaAdapter(prisma, { provider: "mongodb" })` → `"postgresql"`
- `packages/db/prisma/schema/auth.prisma`: remover os `@map("_id")` dos IDs e adotar
  `@default(cuid())`; passam a valer migrações versionadas (`prisma migrate`) em vez de `db push`
- `packages/db/docker-compose.yml`: imagem `mongo` → `postgres:17`
- `apps/web/.env`: nova `DATABASE_URL`

### Decisão 2 — Motor de busca

| Opção | Prós | Contras |
|---|---|---|
| **Meilisearch** (recomendado) | Open-source, self-hosted, tolerante a erro de digitação, busca instantânea, facetas por editoria/data/autor, operação simples | Mais um serviço para hospedar e sincronizar |
| Postgres full-text | Zero infra extra, transacional (sem dessincronia) | Relevância e *typo-tolerance* fracas; ranking manual |
| Algolia | Melhor DX e relevância do mercado, gerenciado | Custo recorrente que cresce com o acervo e com o volume de buscas |
| Elasticsearch | Poder máximo, agregações complexas | Operação pesada (cluster, JVM, tuning) — desproporcional |

✅ **Decidido: Postgres full-text no MVP, Meilisearch na Fase 5** (03/08/2026).
A arquitetura já prevê a porta `ArticleSearchIndex` (ver `architecture.md`), então a troca futura é
a substituição de um adapter — sem tocar em regra de negócio. Isso entrega o MVP mais rápido sem
criar dívida técnica.

Para que a migração seja de fato barata, duas exigências valem desde a Fase 0:

1. Nenhum código fora de `infrastructure/` pode conhecer `tsvector`, `ts_rank` ou qualquer detalhe
   do Postgres. A aplicação enxerga apenas `ArticleSearchIndex.search(query, filtros)`.
2. Os testes de contrato da busca (ver `testing-strategy.md`) rodam contra o adapter Postgres hoje
   e, no dia da troca, contra o Meilisearch **sem alteração no arquivo de teste** — é o sinal
   objetivo de que a substituição foi bem-sucedida.

### Decisão 3 — Armazenamento de mídia

| Opção | Prós | Contras |
|---|---|---|
| **Cloudflare R2** (recomendado) | Compatível com S3, **sem custo de egress**, barato, independente da infra escolhida | Transformação de imagem por conta própria (`next/image` ou Cloudflare Images) |
| Vercel Blob | Integração trivial se o deploy for Vercel | Preso ao ecossistema Vercel |
| Cloudinary | Transformações, crop inteligente e otimização prontas — ótimo para portal com muita foto | Custo maior; lock-in de URL de imagem |
| S3 + CloudFront | Padrão de mercado | Custo de egress relevante em portal de alto tráfego |

✅ **Decidido: Cloudflare R2** (03/08/2026) — o egress gratuito é decisivo para um portal que serve
imagem pesada em volume, e não amarra a decisão de infraestrutura. O redimensionamento fica por
conta do `next/image`; se o volume justificar, Cloudflare Images entra depois sem trocar o storage.
O domínio conversa apenas com a porta `MediaStorage`, então R2 é substituível por qualquer serviço
compatível com S3.

### Decisão 4 — Deploy / Infraestrutura

| Opção | Prós | Contras |
|---|---|---|
| **Vercel** | Zero-config para Next.js, CDN global, preview por PR, ISR e `revalidateTag` funcionam perfeitamente | Custo cresce com tráfego; cron e workers longos são limitados; Redis/Meilisearch/Postgres ficam fora |
| **Self-hosted** (Docker em VPS/cloud) | Custo previsível em escala, controle total, tudo junto (app, Redis, Meilisearch, Postgres) | Exige DevOps: CI/CD, TLS, backup, monitoração, escalonamento |
| **Híbrido** (recomendado) | Next.js na Vercel + Postgres gerenciado (Neon/Supabase) + Redis (Upstash) + R2 | Vários fornecedores para gerenciar |

A decisão foi dividida em duas, porque têm urgências diferentes.

#### ✅ Decisão 4a — Ambiente de desenvolvimento: **Docker Compose** (03/08/2026)

Tudo que a aplicação precisa sobe com **um comando**, sem conta em serviço nenhum:

| Serviço | Imagem / ferramenta | Porta |
|---|---|---|
| PostgreSQL | `postgres:17` | 5432 |
| Redis | `redis:7-alpine` | 6379 |
| Inngest Dev Server | `inngest/inngest` | 8288 |
| Meilisearch *(Fase 5)* | `getmeili/meilisearch` | 7700 |

O `packages/db/docker-compose.yml` do scaffold já existe (hoje com MongoDB) e será a base.

**Por que isso importa mais do que parece:**

- **Paridade dev/prod.** O mesmo Postgres 17 roda na máquina do dev, no CI (via Testcontainers) e
  em produção. A classe de bug "funciona na minha máquina" desaparece.
- **Onboarding real em um comando.** `pnpm db:start && pnpm dev` — sem provisionar nada, sem
  credencial de terceiro, sem custo. Atende o requisito `N10` de `features.md`.
- **Nenhum acoplamento antecipado a fornecedor.** Adiar a decisão de produção não custa nada
  justamente porque tudo é serviço padrão rodando em container.

#### 🕓 Decisão 4b — Produção: **adiada** (a pedido do time, 03/08/2026)

Fica para depois, e isso é seguro: nada nas fases 0 a 3 depende dessa escolha. Todos os serviços
são padrão de mercado (Postgres, Redis, S3, Inngest), então a decisão é de **onde hospedar**, não
de **o quê usar**.

Inclinação registrada, a ser confirmada: híbrido — Vercel para o app, Postgres gerenciado
(Neon ou Supabase), Upstash para Redis, R2 para mídia.

> ⏰ **Prazo real desta decisão:** precisa estar fechada **antes do fim da Fase 4**, que é quando o
> portal vai ao ar. Está registrada como pendência no `roadmap.md`.

Uma opção que ganhou força com a Decisão 4a: como todo o ambiente já é Docker, **self-hosted deixa
de ser um salto** — passa a ser subir os mesmos containers em um servidor. Vale reavaliar na
Fase 4 com números de tráfego reais em vez de estimativa.

### Decisão 5 — Editor de texto do painel administrativo

| Opção | Prós | Contras |
|---|---|---|
| **TipTap** (recomendado) | Sobre ProseMirror (maduro), headless (estilizamos com nosso DS), extensível para blocos próprios (galeria, embed, citação, "leia mais") | Alguns recursos avançados são pagos (colaboração em tempo real) |
| Lexical (Meta) | Performático, acessível, mantido pela Meta | Ecossistema de extensões menor; mais código para escrever |
| Markdown puro | Simples, portável | Ruim para redação não-técnica; limita blocos ricos |

✅ **Decidido: TipTap** (03/08/2026), pela completude do ecossistema de extensões e por ser
headless — a aparência sai inteiramente do nosso design system, sem lutar contra estilo embutido.

O conteúdo é salvo como **JSON estruturado de blocos**, nunca HTML. HTML no banco engessa a
apresentação; com blocos, a mesma matéria é renderizada no site, no app, na newsletter e em feeds
de parceiros, e o conteúdo continua consultável (ex.: "quantas matérias usam bloco de galeria?").

**Como isso se encaixa na arquitetura:**

- O agregado `Article` valida a **estrutura** dos blocos (tipos permitidos, blocos obrigatórios,
  aninhamento) em `domain/` — regra de negócio, testável sem browser e sem o TipTap carregado.
- O TipTap vive **apenas na camada de interface** do painel admin. O domínio não o importa.
- A renderização no portal público é feita por um componente próprio que percorre os blocos — o
  portal **não carrega o TipTap**, o que preserva o orçamento de JavaScript do leitor
  (ver `ui-ux.md` §4).

**Blocos do MVP** (lista fechada na spec da Fase 3): parágrafo, intertítulo, citação, imagem,
galeria, lista, embed (YouTube/X/Instagram), "leia também" e destaque.

**Registrado:** colaboração em tempo real é recurso pago do TipTap. Não está no escopo — o
tratamento de edição concorrente no MVP é o aviso de "outra pessoa está editando" (`A09`).

### Decisão 6 — Jobs em background e despacho de eventos

Necessidade: publicação agendada, despacho do outbox, reindexação de busca, invalidação de ISR,
envio de newsletter e notificações. Tudo isso é trabalho **fora do ciclo de request**.

| Opção | Prós | Contras |
|---|---|---|
| **Inngest** (escolhido) | Funções duráveis com retry e backoff automáticos, passos (`step.run`) retomáveis, cron e delays nativos, idempotência por chave de evento, concorrência controlada, dev server local em Docker, painel de observabilidade | Mais um serviço; modelo mental novo para o time |
| Vercel Cron + rota | Zero dependência | Sem retry, sem durabilidade, limite de duração, sem fan-out — exigiria construir tudo à mão |
| BullMQ + Redis | Maduro, controle total | Exige worker de longa duração (não combina com Vercel), operação e monitoração por nossa conta |
| pg-boss | Fila dentro do próprio Postgres, transacional | Mesmo problema do worker persistente; menos recursos |

✅ **Decidido: Inngest** (03/08/2026).

**O que ele resolve de imediato no nosso caso:**

1. **Publicação agendada** deixa de ser um cron que varre a tabela. Ao agendar, emitimos um evento
   e o Inngest o entrega **no horário exato** (`step.sleepUntil`). O problema de limite de duração
   do cron simplesmente deixa de existir — o risco registrado na versão anterior deste documento
   está **encerrado**.
2. **Outbox durável.** O evento gravado na transação do agregado é despachado com retry automático.
   Se o Meilisearch estiver fora do ar, o Inngest tenta de novo — não perdemos a indexação.
3. **Fan-out sem acoplamento.** `ArticlePublished` dispara, em paralelo e de forma independente,
   indexação, invalidação de ISR, métricas e notificações. Se um falhar, só ele é reprocessado.
   É exatamente o modelo de eventos descrito em `architecture.md` §5, agora com garantia de entrega.
4. **Idempotência de fábrica**, via chave de evento — requisito direto do critério `A13`.

**Fronteira arquitetural (inegociável):** Inngest é **adapter de infraestrutura**, atrás das portas
`EventBus` e `Scheduler`. Nenhum arquivo em `domain/` ou `application/` o importa. Nos testes de
caso de uso continua valendo o `FakeEventBus` — a suíte de aplicação segue sem I/O e em
milissegundos (ver `testing-strategy.md` §5).

**Em desenvolvimento** roda o Inngest Dev Server no Docker Compose (Decisão 4a), sem conta e sem
custo. A escolha entre Inngest Cloud e self-hosted em produção entra junto da Decisão 4b.

---

## 6. O que ficou de fora, e por quê

- **CMS headless pronto (Strapi, Payload, Sanity, WordPress).** Resolveria o MVP mais rápido, mas
  o pedido é explicitamente um projeto de longo prazo com DDD e testes de primeira classe — o CMS
  passa a ditar o modelo de domínio e o fluxo editorial. Fica registrado como alternativa caso a
  prioridade mude para "time-to-market".
- **Microsserviços.** Prematuro. Começamos como **monólito modular** com fronteiras de contexto
  bem definidas; se um contexto precisar escalar sozinho, ele já está isolado o suficiente para
  ser extraído (ver `architecture.md`).
- **GraphQL.** tRPC entrega o mesmo benefício sem servidor de schema, e não temos múltiplos
  consumidores heterogêneos hoje.
- **Redux / Zustand.** RSC + TanStack Query cobrem estado de servidor; estado global de cliente
  é raro aqui.

---

## 7. Resumo das dependências novas previstas

Nada será instalado antes da aprovação. Previsão para a Fase 1 de implementação:

```
Fase 0 (fundação)
  Testes:      vitest, @vitest/coverage-v8, @testing-library/react, @testing-library/user-event,
               @playwright/test, testcontainers, @testcontainers/postgresql, msw, @faker-js/faker
  Qualidade:   dependency-cruiser (fiscaliza as regras de dependência entre camadas/contextos)
  Domínio:     (nenhuma — domínio puro, sem dependências externas, por princípio)

Fase 2 (mídia)         @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner  → Cloudflare R2
Fase 3 (editorial)     inngest · @tiptap/react + extensões (starter-kit, image, link,
                       placeholder, character-count) · slugify · date-fns
Fase 4 (portal)        ioredis (ou @upstash/redis), @sentry/nextjs
Fase 5 (busca)         meilisearch — somente quando a troca do adapter for feita

Docker (dev, sem entrar no package.json)
  postgres:17 · redis:7-alpine · inngest/inngest · getmeili/meilisearch (Fase 5)
```

Duas notas sobre esta lista:

- **O domínio não recebe dependência nenhuma, em nenhuma fase.** É o que garante teste unitário
  instantâneo e imunidade a quebra de biblioteca. Qualquer PR que adicione um import externo em
  `domain/` será barrado pelo `dependency-cruiser` no CI.
- Nada é instalado antecipadamente. Cada dependência entra na fase em que é usada, junto com o
  código que a justifica.

O **domínio sem dependências** é intencional: é o que torna o teste unitário instantâneo e o
código imune a quebra de biblioteca.

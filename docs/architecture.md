# Arquitetura — Domain-Driven Design

> **Status:** Aprovado em 03/08/2026.
> Banco de dados definido: **PostgreSQL** (Decisão 1 de `stack.md`). Vale notar que este desenho
> seria idêntico com outro banco — a escolha só afeta a camada `infrastructure/` de cada contexto.
> É exatamente esse o resultado que a arquitetura busca.

---

## 1. Visão geral: monólito modular

O sistema nasce como **um único deployable** (`apps/web`), internamente dividido em
**bounded contexts** isolados, cada um um pacote do monorepo.

**Por que não microsserviços agora:** o custo de rede, deploy, observabilidade e consistência
distribuída não se paga com um time pequeno e um produto ainda não validado. **Por que não um
monólito comum:** porque daqui a dois anos ninguém consegue mais separá-lo.

O monólito modular é o meio-termo: **fronteiras de microsserviço, custo operacional de monólito**.
Se amanhã o contexto de *Analytics* precisar escalar sozinho, ele já é um pacote com interface
própria e comunicação por eventos — extrair é mover uma pasta e trocar o barramento de eventos.

```
┌──────────────────────────────────────────────────────────────┐
│                      apps/web (Next.js)                      │
│   Portal público (RSC/ISR)   │   Painel admin (tRPC/CSR)     │
└───────────────┬──────────────┴───────────────┬───────────────┘
                │      camada de interface     │
┌───────────────▼──────────────────────────────▼───────────────┐
│                    packages/contexts/*                        │
│  editorial │ taxonomy │ identity │ media │ engagement │ ...   │
│         (domínio + aplicação + infraestrutura)                │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
        ┌───────▼───────┐            ┌─────────▼─────────┐
        │ packages/db   │            │  adapters extern. │
        │ (Prisma)      │            │  R2 · Redis · busca│
        └───────────────┘            └───────────────────┘
```

---

## 2. Bounded Contexts

Cada contexto tem **sua própria linguagem ubíqua**. A mesma palavra pode significar coisas
diferentes em contextos diferentes — e isso é desejável, não um defeito. Exemplo: "Usuário" em
*Identidade* é alguém com papel e permissões; em *Engajamento* é apenas um autor de comentário
com nome e avatar. Não existe um "modelo de usuário único" — essa é a armadilha clássica que
transforma sistemas em bola de lama.

### 2.1 Editorial (núcleo) — `packages/contexts/editorial`

**Responsabilidade:** o ciclo de vida da matéria, do rascunho ao arquivamento.
É o **core domain** — onde está a vantagem competitiva e onde vale investir mais esforço.

- **Agregado raiz:** `Article`
- **Entidades/VOs:** `Headline`, `Slug`, `Kicker` (chapéu), `Standfirst` (linha fina), `Body`
  (lista de blocos), `Byline` (assinatura), `PublicationSchedule`, `EditorialStatus`
- **Invariantes (regras que o agregado protege):**
  - Não se publica matéria sem título, corpo e editoria.
  - Não se publica matéria sem imagem principal **com texto alternativo** (regra de
    acessibilidade virando regra de negócio).
  - `slug` é único e imutável após a primeira publicação (URL não pode quebrar).
  - Só se agenda para o futuro; ao chegar a hora, o estado transiciona sozinho.
  - Transições de estado válidas apenas:
    `RASCUNHO → EM_REVISÃO → APROVADA → AGENDADA → PUBLICADA → ATUALIZADA → ARQUIVADA`
    (e `EM_REVISÃO → RASCUNHO` na devolução com motivo).
  - Matéria publicada não é apagada — é arquivada (integridade do acervo jornalístico).
- **Eventos de domínio:** `ArticlePublished`, `ArticleUpdated`, `ArticleScheduled`,
  `ArticleUnpublished`, `ArticleSubmittedForReview`, `ArticleRejected`

### 2.2 Taxonomia — `packages/contexts/taxonomy`

**Responsabilidade:** como o conteúdo é organizado e navegado.

- **Agregados:** `Section` (editoria: Política, Esportes, Cidades…), `Tag`, `Special` (especiais/séries)
- **Invariantes:** editoria tem slug único; hierarquia de no máximo 2 níveis (evita menu
  infinito e URL confusa); editoria com matérias publicadas não pode ser excluída, só desativada.
- **Relação com Editorial:** *Customer/Supplier*. Editorial consome, Taxonomia fornece.

### 2.3 Identidade & Acesso — `packages/contexts/identity`

**Responsabilidade:** quem trabalha na redação e o que cada um pode fazer.

- **Agregado raiz:** `StaffMember` (usuário interno)
- **VOs:** `Role` (`ADMIN | EDITOR | REDATOR`), `Permission`, `AuthorProfile` (bio, foto, redes —
  importante para E-E-A-T do Google)
- **Regras de autorização como domínio testável:**
  - `REDATOR`: cria e edita **os próprios** rascunhos; submete para revisão; **não publica**.
  - `EDITOR`: revisa, aprova, publica, agenda e edita qualquer matéria da(s) editoria(s) dele.
  - `ADMIN`: tudo, incluindo gestão de usuários, editorias e configurações.
- **Relação com Better-Auth:** a biblioteca resolve **autenticação** e é um *adapter* de
  infraestrutura. A **autorização** é domínio puro — uma função
  `can(staff, 'article:publish', article)` testável em milissegundos, sem HTTP e sem banco.
  Esta é a separação que evita regra de permissão espalhada por controllers.

### 2.4 Mídia — `packages/contexts/media`

- **Agregado raiz:** `MediaAsset` (imagem, vídeo, áudio, documento)
- **VOs:** `Caption` (legenda), `Credit` (crédito/fotógrafo — obrigatório por questão jurídica),
  `AltText`, `Dimensions`, `FocalPoint` (ponto focal para corte responsivo sem decapitar pessoas)
- **Invariantes:** imagem sem `altText` não pode ser vinculada a matéria publicada; todo asset
  tem crédito.
- **Porta:** `MediaStorage` (implementada por R2/S3/local — o domínio não sabe onde o arquivo mora).

### 2.5 Engajamento — `packages/contexts/engagement`

- **Agregados:** `Comment` (com thread), `Reaction`
- **Invariantes:** comentário em matéria com comentários desabilitados é rejeitado; profundidade
  máxima de resposta = 2; moderação com estados `PENDENTE | APROVADO | REJEITADO | DENUNCIADO`.
- **Relação com Editorial:** *Conformist* — consome `articleId` como referência opaca. Não há
  chave estrangeira entre contextos; a integridade se dá por eventos.

### 2.6 Audiência — `packages/contexts/audience`

**Responsabilidade:** o leitor (distinto do funcionário da redação).

- **Agregado raiz:** `Reader` — preferências, editorias seguidas, inscrição em newsletter,
  matérias salvas. **Pós-MVP.**

### 2.7 Distribuição — `packages/contexts/distribution`

**Responsabilidade:** levar o conteúdo publicado para fora do site.

- Indexação na busca, RSS por editoria, `sitemap.xml`, `news-sitemap.xml`, Open Graph,
  push notification, newsletter.
- **Não tem agregado próprio relevante** — é um contexto majoritariamente reativo: escuta
  `ArticlePublished` e age. Contexto de *Open Host Service*.

### 2.8 Analytics — `packages/contexts/analytics`

- **Responsabilidade:** pageviews, mais lidas, tempo de leitura, origem de tráfego.
- Escrita em altíssimo volume e leitura agregada → **modelo próprio**, desacoplado, tolerante a
  perda eventual (um pageview perdido não é problema de negócio).

---

## 3. Context Map

```
                    ┌──────────────┐
                    │   IDENTITY   │  (upstream — Open Host Service)
                    └──────┬───────┘
                           │ autoria, autorização
                           ▼
  ┌────────────┐    ┌──────────────┐    ┌───────────┐
  │  TAXONOMY  │───▶│  EDITORIAL   │◀───│   MEDIA   │
  └────────────┘ C/S│   (CORE)     │ C/S└───────────┘
                    └──────┬───────┘
                           │ eventos de domínio
              ┌────────────┼────────────┬──────────────┐
              ▼            ▼            ▼              ▼
      ┌─────────────┐ ┌─────────┐ ┌───────────┐ ┌────────────┐
      │DISTRIBUTION │ │ANALYTICS│ │ENGAGEMENT │ │  AUDIENCE  │
      └─────────────┘ └─────────┘ └───────────┘ └────────────┘
           (todos conformist / reativos a eventos)

Legenda: C/S = Customer/Supplier · fluxo = direção da dependência
```

**Regra inegociável:** contextos **nunca** importam entidades uns dos outros. A comunicação é por:

1. **Eventos de domínio** (assíncrono, desacoplado) — o caminho preferencial;
2. **Interfaces publicadas** (`ArticleSummary`, `SectionRef`) — DTOs simples, nunca agregados;
3. **Anti-Corruption Layer** quando um contexto precisa traduzir o modelo de outro.

Essa regra será **verificada automaticamente no CI** com `dependency-cruiser` — arquitetura que
depende só de disciplina humana degrada em meses.

---

## 4. Camadas dentro de cada contexto

```
packages/contexts/editorial/
├── src/
│   ├── domain/                  ← ZERO dependências externas
│   │   ├── article.ts               agregado, invariantes, transições
│   │   ├── value-objects/           Slug, Headline, Body, ...
│   │   ├── events/                  ArticlePublished, ...
│   │   ├── errors/                  CannotPublishWithoutCover, ...
│   │   └── ports/                   ArticleRepository, Clock, SlugGenerator (interfaces)
│   ├── application/             ← casos de uso; depende só de domain/
│   │   ├── commands/                PublishArticle, ScheduleArticle, SubmitForReview
│   │   ├── queries/                 GetArticleBySlug, ListHomepageArticles
│   │   └── ports/                   SearchIndexer, EventBus
│   ├── infrastructure/          ← implementa as portas; depende de application/ e domain/
│   │   ├── prisma-article.repository.ts
│   │   ├── article.mapper.ts        modelo de persistência ↔ agregado
│   │   └── postgres-search.indexer.ts   (troca por meilisearch na Fase 5)
│   └── index.ts                 ← única superfície pública do pacote
└── tests/
    ├── unit/                    domínio + aplicação (sem I/O, milissegundos)
    ├── integration/             infraestrutura com Testcontainers
    └── contract/               suíte que roda contra fake E implementação real
```

### Regra de dependência (fluxo sempre para dentro)

```
interface (Next.js/tRPC) ──▶ application ──▶ domain
                                  ▲             ▲
                            infrastructure ─────┘
```

- `domain/` **não importa nada** — nem Prisma, nem Next, nem Zod. É TypeScript puro.
- `application/` importa `domain/` e declara **portas** (interfaces) para o que precisa do mundo.
- `infrastructure/` **implementa** as portas. É a única camada que conhece Prisma, HTTP, S3.
- A camada de interface (Next.js) só chama casos de uso — nunca repositório, nunca Prisma direto.

**A inversão de dependência é o ponto central:** o domínio **declara** `ArticleRepository`;
a infraestrutura **obedece**. Por isso trocar MongoDB por Postgres, ou Postgres por outra coisa,
não toca uma linha de regra de negócio — e por isso o teste unitário não precisa de banco.

---

## 5. Exemplo concreto: publicar uma matéria

```ts
// domain/article.ts — regra pura, sem framework
publish(now: Date): Result<void, PublishError> {
  if (this.status !== EditorialStatus.APROVADA)
    return err(new InvalidTransition(this.status, "PUBLICADA"));
  if (!this.coverImage)              return err(new CoverImageRequired());
  if (!this.coverImage.hasAltText()) return err(new AltTextRequired());
  if (!this.sectionId)               return err(new SectionRequired());

  this.status      = EditorialStatus.PUBLICADA;
  this.publishedAt = now;
  this.record(new ArticlePublished(this.id, this.slug, this.sectionId, now));
  return ok();
}
```

```ts
// application/commands/publish-article.ts — orquestração, sem regra
export class PublishArticle {
  constructor(
    private articles: ArticleRepository,   // porta
    private events: EventBus,              // porta
    private clock: Clock,                  // porta (torna "agora" testável)
  ) {}

  async execute(input: PublishArticleInput, actor: StaffMember) {
    if (!can(actor, "article:publish")) return err(new Forbidden());

    const article = await this.articles.findById(input.articleId);
    if (!article) return err(new ArticleNotFound());

    const result = article.publish(this.clock.now());
    if (result.isErr()) return result;

    await this.articles.save(article);           // transação
    await this.events.publishAll(article.pullEvents());  // outbox
    return ok();
  }
}
```

O evento `ArticlePublished` é consumido de forma independente por:
*Distribution* (indexa na busca, invalida ISR, dispara push), *Analytics* (cria o registro de
métricas) e *Audience* (notifica quem segue a editoria). **Nenhum deles é conhecido pelo
Editorial** — adicionar um quarto consumidor amanhã não altera o código de publicação.

**Entrega transacional:** os eventos são gravados na mesma transação do agregado
(*transactional outbox*) e despachados depois. Isso evita o clássico "salvou mas não indexou".

**Despacho com Inngest — projetado, NÃO implementado.** O quadro abaixo é o desenho de destino, e
descreve o que um adapter de Inngest daria. Hoje o relay do outbox entrega a um `SyncEventBus`
in-process, e o agendamento roda por um `TaskRegistry` (porta `Scheduler`) dirigido pelo cron da
Vercel. Ver o estado real em [`adr/0007`](./adr/0007-eventos-e-agendamento-atras-de-portas.md)
§"Estado da implementação". O que o Inngest acrescentaria:

- **Retry com backoff** por consumidor. Se o índice de busca estiver fora do ar, só a indexação é
  reprocessada — a publicação já aconteceu e o resto do fan-out não é afetado.
- **Passos duráveis** (`step.run`): cada efeito colateral é persistido individualmente, então um
  retry nunca reexecuta o passo que já deu certo. É o que impede "newsletter enviada duas vezes".
- **Entrega no futuro** (`step.sleepUntil`): o agendamento de publicação não precisa de cron
  varrendo tabela — a matéria agendada emite um evento que é entregue no horário exato.
- **Idempotência por chave de evento**, satisfazendo o critério `A13` de `features.md`.

**A fronteira permanece intacta:** o Inngest ficaria atrás das portas `EventBus`
(`editorial/domain/ports/`) e `Scheduler` (`shared-kernel/src/ports/`), que já existem e já são o
que a aplicação usa. `domain/` e `application/` não importam agendador nenhum — o que preserva os
testes de caso de uso rodando em memória, sem I/O, e é o que torna a adoção (ou o abandono) do
Inngest um arquivo na raiz de composição.

```
Article.publish()  →  evento no outbox (mesma transação)
                              │
                         relay → Inngest
                              │  fan-out durável, com retry por consumidor
        ┌─────────────────────┼─────────────────────┬──────────────────┐
        ▼                     ▼                     ▼                  ▼
  indexar busca      invalidar ISR/CDN      registrar métrica    notificar leitores
  (Distribution)       (Distribution)         (Analytics)          (Audience)
```

---

## 6. Leitura x Escrita (CQRS pragmático)

Portal de notícias é 99% leitura. Forçar toda leitura a reconstituir agregados seria lento e
inútil — agregado existe para **proteger invariante na escrita**, não para exibir lista.

- **Escrita (admin):** passa pelo agregado, com todas as invariantes. Correção acima de velocidade.
- **Leitura (portal):** *query handlers* dedicados devolvem **DTOs de leitura** direto do banco
  (`select` enxuto, sem carregar o agregado inteiro). Velocidade acima de pureza.

Não haverá event sourcing nem base de leitura separada no MVP — complexidade injustificada.
A separação lógica, porém, deixa a porta aberta caso um dia seja necessário.

---

## 7. Como a arquitetura sustenta os testes

Este é o principal retorno do investimento em DDD:

| Camada | Como se testa | Precisa de I/O? | Velocidade |
|---|---|---|---|
| `domain/` | Instancia o agregado e verifica invariantes e transições | Não | ~1 ms |
| `application/` | Executa o caso de uso com **fakes in-memory** das portas | Não | ~5 ms |
| `infrastructure/` | Testcontainers com banco real | Sim | ~1 s |
| interface (tRPC/rotas) | Playwright / testes de rota | Sim | ~2 s |

Três consequências práticas:

1. **A regra de negócio mais complexa é a mais barata de testar.** "Redator não pode publicar",
   "não publica sem alt text", "não agenda no passado" — tudo isso são testes de milissegundos,
   sem Docker, sem servidor. É o que mantém a suíte rápida mesmo com milhares de casos.
2. **Fakes são legítimos, não gambiarra.** `InMemoryArticleRepository` implementa a **mesma
   interface** do repositório real e é validado pela **mesma suíte de testes de contrato**. Se o
   fake e o real passam nos mesmos testes, o fake é confiável — diferente de um mock arbitrário.
3. **Determinismo por construção.** `Clock`, `IdGenerator` e `SlugGenerator` são portas. Testar
   "agendar para amanhã" ou "publicar às 6h" não depende do relógio da máquina de CI.

---

## 8. Estrutura final do monorepo

```
apps/
  web/                       Next.js: portal público + painel admin
packages/
  contexts/
    editorial/               core domain
    taxonomy/
    identity/
    media/
    engagement/
    distribution/
    analytics/
    audience/                (pós-MVP)
  shared-kernel/             Result, Id, DomainEvent, AggregateRoot, Clock, tipos base
  api/                       tRPC routers — camada de interface, orquestra casos de uso
  (jobs/)                    PLANEJADO, não existe — as tarefas agendadas moram hoje em api/scheduler.ts
  auth/                      Better-Auth (adapter de autenticação)
  db/                        Prisma schema + client
  ui/                        design system (shadcn/ui + tokens)
  env/                       variáveis tipadas
  config/                    tsconfig base, configs de teste compartilhadas
docs/                        specs (este diretório)
```

**Sobre o `shared-kernel`:** contém apenas primitivas técnicas sem regra de negócio (`Result`,
`AggregateRoot`, `DomainEvent`, `Clock`). É deliberadamente minúsculo — todo shared kernel tende
a inchar e virar acoplamento global disfarçado. Nenhum conceito de negócio entra ali.

**Sobre o `packages/db`:** hospeda o schema Prisma unificado (uma migração só, um banco só), mas
**cada contexto só acessa suas próprias tabelas**, através do seu próprio repositório. É o padrão
de *schema compartilhado com propriedade separada* — se um contexto for extraído no futuro, suas
tabelas vão junto.

---

## 9. Decisões arquiteturais registradas (ADRs)

Cada decisão relevante vira um ADR em `docs/adr/NNNN-titulo.md`, com contexto, alternativas,
decisão e consequências. ADRs previstos para a Fase 2:

- `0001` — Monólito modular em vez de microsserviços
- `0002` — PostgreSQL como banco principal (migração a partir do MongoDB do scaffold)
- `0003` — Corpo da matéria em blocos JSON em vez de HTML
- `0004` — Autorização como domínio, não como middleware
- `0005` — Outbox transacional para eventos de domínio
- `0006` — Busca atrás de porta: Postgres full-text no MVP, Meilisearch depois
- `0007` — Inngest para jobs em background e despacho de eventos
- `0008` — Docker Compose como ambiente de desenvolvimento padrão

**Por que ADRs:** em um projeto de anos, o custo maior não é decidir — é o dev que chega em 2028
e não sabe **por que** foi decidido assim, e refaz tudo errado.

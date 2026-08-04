# Estratégia de Testes

> **Status:** Aprovado em 03/08/2026.
> Complementa `architecture.md` — a estratégia abaixo só funciona por causa da separação em
> camadas descrita lá. Os dois documentos devem ser lidos juntos.

---

## 1. Por que testes são requisito de arquitetura, não tarefa extra

Em um portal de notícias, um bug em produção é público e imediato: matéria publicada antes da
hora, notícia arquivada que sai do ar, redator publicando sem revisão. Não há como "testar
manualmente" um fluxo editorial com dezenas de estados a cada release.

A meta prática é simples: **um dev deve conseguir mudar uma regra de negócio e saber em menos de
10 segundos se quebrou alguma coisa.** Tudo abaixo existe para isso.

O erro clássico é fazer todo teste passar por HTTP e banco. A suíte demora 20 minutos, o time
para de rodá-la, e ela morre. A arquitetura DDD evita isso permitindo que **a regra mais complexa
seja a mais barata de testar**.

---

## 2. A pirâmide, mapeada nas camadas

```
                    ╱╲
                   ╱  ╲     E2E — Playwright             ~30 testes   ~2 min
                  ╱────╲    Fluxos críticos de ponta a ponta
                 ╱      ╲
                ╱────────╲  Integração — Testcontainers  ~150 testes  ~60 s
               ╱          ╲ Repositórios, adapters, rotas
              ╱────────────╲
             ╱              ╲ Aplicação — Vitest + fakes ~400 testes  ~3 s
            ╱────────────────╲Casos de uso, autorização, orquestração
           ╱                  ╲
          ╱────────────────────╲ Domínio — Vitest puro   ~800 testes  ~1 s
         ╱______________________╲Invariantes, transições, VOs
```

Os números são ordem de grandeza esperada ao fim do MVP, não meta. O que importa é a **proporção**:
a base é larga e instantânea; o topo é estreito e caro.

| Camada | O que testa | Dependências | Tempo/teste |
|---|---|---|---|
| Domínio | Invariantes, transições de estado, value objects | Nenhuma | ~1 ms |
| Aplicação | Casos de uso, autorização, orquestração, eventos emitidos | Fakes in-memory | ~5 ms |
| Integração | Repositórios Prisma, adapters R2/Redis/busca, rotas tRPC | Docker (Testcontainers) | ~1 s |
| E2E | Jornadas reais no browser | App completo | ~5 s |

---

## 3. Ferramentas

| Ferramenta | Uso | Por quê |
|---|---|---|
| **Vitest** | Unit + integração | Mesmo motor do bundler, execução em ms, suporte nativo a TS/ESM e a *workspaces* (essencial no monorepo) |
| **@testing-library/react** | Componentes | Testa pelo que o usuário vê e faz, não por detalhe de implementação — e força marcação acessível |
| **@testing-library/user-event** | Interação | Simula teclado/mouse de forma realista (inclui foco e navegação por Tab) |
| **Playwright** | E2E | Multi-browser, *tracing* em falha, paralelismo e shards no CI |
| **Testcontainers** | Integração | Postgres/Redis reais e efêmeros por execução |
| **MSW** | HTTP externo | Intercepta na camada de rede — o código sob teste não sabe que está sendo testado |
| **@faker-js/faker** | Dados | Alimenta os *builders* de teste |
| **axe-core** | Acessibilidade | Via `vitest-axe` (componente) e `@axe-core/playwright` (página) |
| **dependency-cruiser** | Arquitetura | Falha o CI se alguém violar a regra de dependência entre camadas |
| **Inngest Dev Server** | Jobs e eventos | Roda as funções de background localmente e no CI pela CLI (`npx inngest-cli dev`), sem depender de serviço externo |

**Vitest workspace:** cada pacote em `packages/contexts/*` tem sua própria config, mas roda por um
comando único na raiz. Permite `pnpm test --filter editorial` durante o desenvolvimento e a suíte
inteira no CI.

---

## 4. Camada de domínio — testes puros

Sem mock, sem banco, sem framework. Instancia o agregado e verifica a regra.

```ts
describe("Article.publish", () => {
  it("não publica matéria sem imagem de capa", () => {
    const article = anArticle().aprovada().semCapa().build();

    const result = article.publish(new Date("2026-08-03T10:00:00Z"));

    expect(result).toBeErr(CoverImageRequired);
    expect(article.status).toBe(EditorialStatus.APROVADA); // não mudou de estado
  });

  it("não publica matéria cuja capa não tem texto alternativo", () => {
    const article = anArticle().aprovada().comCapaSemAltText().build();

    expect(article.publish(agora())).toBeErr(AltTextRequired);
  });

  it("registra ArticlePublished ao publicar com sucesso", () => {
    const article = anArticle().aprovada().build();

    article.publish(new Date("2026-08-03T10:00:00Z"));

    expect(article.pullEvents()).toContainEventOfType(ArticlePublished);
  });
});
```

**Regras de escrita:**

- Nomes de teste descrevem a **regra de negócio em português**, não o método. Quando um teste
  falha no CI, o nome deve explicar o que o produto deixou de garantir.
- Um comportamento por teste. Padrão AAA (Arrange, Act, Assert) com linha em branco separando.
- Sempre verificar o **estado após a falha**: uma operação inválida não pode deixar o agregado
  meio-alterado. É onde bugs sutis se escondem.

### Builders (Object Mother)

Testes que constroem agregados na mão viram inmanuteníveis: adicionar um campo obrigatório quebra
300 testes. Cada contexto exporta *builders* com padrões válidos:

```ts
anArticle().aprovada().naEditoria("politica").agendadaPara(amanha()).build()
```

Os builders ficam em `tests/builders/` e são exportados pelo pacote para uso em outros contextos.

---

## 5. Camada de aplicação — casos de uso com fakes

Testa orquestração e **autorização**, sem tocar em infraestrutura.

```ts
describe("PublishArticle", () => {
  it("impede que redator publique matéria", async () => {
    const articles = new InMemoryArticleRepository([anArticle().aprovada().build()]);
    const useCase  = new PublishArticle(articles, new FakeEventBus(), fixedClock("2026-08-03"));

    const result = await useCase.execute({ articleId: "art-1" }, umRedator());

    expect(result).toBeErr(Forbidden);
  });

  it("publica e despacha o evento quando o ator é editor", async () => {
    const events   = new FakeEventBus();
    const articles = new InMemoryArticleRepository([anArticle().aprovada().build()]);
    const useCase  = new PublishArticle(articles, events, fixedClock("2026-08-03"));

    await useCase.execute({ articleId: "art-1" }, umEditor());

    expect(events.published()).toContainEventOfType(ArticlePublished);
  });
});
```

**Por que fakes e não mocks:** um mock verifica que um método foi chamado — acopla o teste à
implementação e passa mesmo quando a lógica está errada. Um **fake** é uma implementação real e
simplificada (um `Map` em memória) que se comporta como o de verdade. O teste continua verificando
**resultado**, não chamada.

---

## 6. Testes de contrato — o que legitima os fakes

Esta é a peça central da estratégia. Um fake só é confiável se comprovadamente se comportar como a
implementação real. Por isso a suíte de testes do repositório é **escrita uma vez** e executada
contra as duas implementações:

```ts
// tests/contract/article-repository.contract.ts
export function articleRepositoryContract(
  nome: string,
  criar: () => Promise<ArticleRepository>,
) {
  describe(`ArticleRepository — contrato (${nome})`, () => {
    it("recupera por slug uma matéria salva", async () => { /* ... */ });
    it("devolve null para slug inexistente", async () => { /* ... */ });
    it("preserva a ordem dos blocos do corpo", async () => { /* ... */ });
    it("rejeita slug duplicado", async () => { /* ... */ });
    it("não retorna matérias arquivadas em listagens públicas", async () => { /* ... */ });
  });
}

// unit  — instantâneo
articleRepositoryContract("in-memory", async () => new InMemoryArticleRepository());
// integração — com Postgres real
articleRepositoryContract("prisma", async () => new PrismaArticleRepository(await testDb()));
```

Consequências:

1. Se o fake divergir do real, **um teste falha** — a divergência não passa silenciosa.
2. Trocar a implementação (Postgres full-text → Meilisearch na Fase 5) é validado **sem escrever
   um teste novo**: basta o novo adapter passar no contrato existente.
3. O contrato documenta o comportamento esperado da porta melhor que qualquer comentário.

Toda porta com mais de uma implementação tem contrato: `ArticleRepository`, `MediaStorage`,
`ArticleSearchIndex`, `EventBus`, `Cache`.

---

## 7. Testes de integração — Testcontainers

Repositório testado contra mock é ilusão de cobertura: não pega erro de mapeamento, constraint
violada, transação mal delimitada, tipo de coluna errado nem `N+1`. Por isso a integração usa
**Postgres de verdade**, subido e destruído pelo próprio teste.

```ts
const container = await new PostgreSqlContainer("postgres:17").start();
```

**Regras de isolamento:**

- Um container por *worker* de teste, reutilizado entre arquivos (subir container por teste é
  proibitivo).
- Isolamento por **transação com rollback** ao fim de cada teste — mais rápido e mais confiável
  que truncar tabelas, e permite paralelismo.
- Migrações aplicadas uma vez, na criação do container — as mesmas de produção. Testar contra um
  schema montado à mão esconde erros de migração.

O mesmo vale para Redis e, na Fase 5, Meilisearch.

---

## 8. Testes de jobs e eventos (Inngest)

Trabalho assíncrono costuma ser a área menos testada de um sistema — e a que mais causa incidente
silencioso. A divisão em camadas resolve isso separando **o que decidir** de **quando executar**.

### O caso de uso continua sendo testado sem Inngest

A função Inngest é uma **casca fina**: ela recebe o evento e chama o caso de uso. Toda a regra
está no caso de uso, testado com `FakeEventBus` em milissegundos (§5). Nenhum teste de regra de
negócio precisa do Inngest no ar.

```ts
it("emite ArticlePublished ao publicar matéria agendada vencida", async () => {
  const events = new FakeEventBus();
  const useCase = new PublishScheduledArticles(articles, events, fixedClock("2026-08-03T06:00Z"));

  await useCase.execute();

  expect(events.published()).toContainEventOfType(ArticlePublished);
});
```

### O que se testa de fato no nível do Inngest

Apenas o que é responsabilidade dele — e usando o dev server em Docker:

| O que verificar | Por que importa |
|---|---|
| **Idempotência** | Entregar o mesmo evento duas vezes publica a matéria **uma** vez (`A13`) |
| **Agendamento** | Evento com `sleepUntil` dispara no horário correto, com relógio controlado |
| **Retry** | Consumidor que falha é reprocessado; consumidor que teve sucesso **não** reexecuta |
| **Isolamento do fan-out** | Falha na indexação de busca não impede a invalidação do ISR |
| **Outbox** | Rollback da transação do agregado **não** deixa evento órfão despachado |

O último é o teste mais valioso da lista: ele prova que o par "salvar agregado + emitir evento" é
atômico. É a garantia de que o sistema nunca fica com o banco dizendo uma coisa e a busca outra.

### No CI
O Postgres e o Redis sobem em container (Testcontainers) no job de integração; o Inngest Dev
Server sobe pela CLI (`npx inngest-cli dev`) no mesmo job. Sem conta, sem chave de API, sem rede
externa — o CI continua reproduzível e offline.

---

## 9. Testes E2E — Playwright

Poucos, caros e reservados aos fluxos onde a falha é inaceitável:

| Fluxo | Por que é crítico |
|---|---|
| Redator cria rascunho → editor aprova e publica → matéria aparece no portal | Fluxo central do produto; cruza 4 contextos |
| Leitor abre a home e navega até uma matéria | Caminho de 90% do tráfego |
| Busca retorna resultado relevante | Ponto de entrada importante |
| Agendamento publica a matéria no horário | Lógica de tempo, difícil de validar de outra forma |
| Login e bloqueio por papel no admin | Segurança |
| Upload de imagem com legenda e crédito | Integra storage e regra de negócio |

**Práticas:**

- Seletores por **papel acessível** (`getByRole("button", { name: "Publicar" })`), nunca por
  classe CSS. Testes assim quebram menos e ainda validam acessibilidade de graça.
- Estado de autenticação salvo e reaproveitado (`storageState`) — não faz login pela UI em todo
  teste.
- Banco semeado por *seed* determinístico antes da suíte.
- Zero `waitForTimeout`. Só espera por condição observável.
- Em falha, o CI publica *trace*, vídeo e screenshot como artefato.

---

## 10. Metas de cobertura

Cobertura é **indicador, não meta**. 100% de cobertura com asserção fraca é pior que 80% com
asserção forte, porque dá falsa confiança. As metas abaixo são limiares mínimos no CI:

| Escopo | Mínimo | Racional |
|---|---|---|
| `domain/` | **95%** | É a regra de negócio. Linha não coberta aqui é risco direto |
| `application/` | **90%** | Casos de uso e autorização |
| `infrastructure/` | **70%** | Caminhos de erro raros de I/O não compensam o esforço |
| Componentes de UI | **60%** | Foco no comportamento; E2E cobre o resto |
| **Global** | **80%** | Trava do projeto |

**Excluídos da medição:** arquivos gerados pelo Prisma, `*.config.*`, primitivos do
`packages/ui` vindos do shadcn, layouts e barrels (`index.ts` que só reexporta).

**Regra de qualidade acima do número:** todo bug corrigido entra com um **teste de regressão que
falha antes da correção**. É a única forma de garantir que a suíte cresce onde o sistema realmente
erra — e não onde é fácil testar.

**Mutation testing (opcional, a partir da Fase 3):** Stryker rodando semanalmente apenas sobre
`domain/`. Ele responde a pergunta que cobertura não responde: "se eu inverter este `if`, algum
teste percebe?".

---

## 11. Determinismo — tempo, IDs e aleatoriedade

Teste que falha às sextas-feiras, ou de madrugada, destrói a confiança na suíte. Três portas
resolvem isso, definidas em `packages/shared-kernel`:

| Porta | Produção | Teste |
|---|---|---|
| `Clock` | `SystemClock` | `FixedClock(new Date("2026-08-03T10:00:00Z"))` |
| `IdGenerator` | `CuidGenerator` | `SequentialIdGenerator` (`art-1`, `art-2`, …) |
| `SlugGenerator` | `slugify` + verificação de unicidade | fake determinístico |

Isso permite testar "agendar para amanhã às 6h", "não publica no passado" e "matéria das últimas
48h no news-sitemap" com precisão, sem `sleep` e sem *flakiness*.

Fuso horário: o CI roda com `TZ=America/Sao_Paulo` fixado, e todo timestamp é persistido em UTC.
Portal de notícias tem regra sensível a horário — essa combinação evita a classe inteira de bugs de
"publicou 3h antes".

---

## 12. Testes não-funcionais

### Acessibilidade
- `vitest-axe` nos componentes do `packages/ui` — nenhuma violação de nível A/AA passa.
- `@axe-core/playwright` nas páginas principais (home, matéria, editoria, busca, editor do admin).
- Teste explícito de navegação por teclado no fluxo de publicação.
- Verificação automática de que **toda imagem publicada tem alt** — é invariante de domínio
  (seção 2.1 de `architecture.md`), então já falha em teste unitário. O teste de página é a
  segunda barreira.

### Performance
- **Lighthouse CI** por PR nas rotas públicas, com orçamento que falha o build:
  LCP < 2,5 s · INP < 200 ms · CLS < 0,1 · JS inicial < 150 KB.
- Teste de detecção de `N+1` na integração: conta queries emitidas ao renderizar a home. Se passar
  do limite, falha. Esse é o gargalo real de portal com muitas chamadas por página.

### Arquitetura
`dependency-cruiser` no CI, com as regras de `architecture.md` codificadas:

```
domain/         → não pode importar application/, infrastructure/, nem NADA externo
application/    → só pode importar domain/ e shared-kernel
infrastructure/ → não pode ser importada pela camada de interface
contexts/*      → não podem importar entidades uns dos outros (só interfaces publicadas)
```

Sem isso, a arquitetura depende de revisão humana — e degrada em meses.

### Segurança
- Teste de autorização por papel em **todo** procedimento tRPC mutante: um teste parametrizado
  percorre a lista de rotas e verifica que ator sem permissão recebe `FORBIDDEN`. Assim, rota nova
  sem proteção quebra o CI.
- `pnpm audit` e Dependabot semanais.

---

## 13. Pipeline de CI (GitHub Actions)

```
push / pull request
        │
        ├── setup (pnpm install + cache do Turborepo)
        │
        ├── ▸ lint & format      biome ci                      ~20 s  ┐
        ├── ▸ typecheck          tsc --noEmit (todos)          ~40 s  │ paralelos
        ├── ▸ arquitetura        dependency-cruiser            ~15 s  │
        ├── ▸ testes unitários   vitest (domínio + aplicação)  ~30 s  ┘
        │
        ├── ▸ integração         vitest + Testcontainers       ~2 min
        │                        (Postgres · Redis em container; Inngest dev via CLI)
        ├── ▸ build              turbo build                   ~2 min
        │
        ├── ▸ e2e                playwright (4 shards)         ~3 min
        └── ▸ lighthouse         orçamento de performance      ~1 min
                │
                └── merge liberado apenas com tudo verde
```

- **Cache remoto do Turborepo**: pacote não alterado não é reconstruído nem retestado. É o que
  mantém o CI abaixo de 5 minutos mesmo com o monorepo crescendo.
- **Preview deploy por PR** na Vercel; o E2E roda contra o preview, não contra `localhost` — pega
  problema de build de produção que o dev nunca vê.
- **Branch protection** em `main`: sem CI verde, sem merge.
- Falhas de E2E publicam trace e vídeo como artefato do job.

### Hooks locais (pré-commit)
Rápido e sem atrito — o CI é a rede de segurança, não o pre-commit:
`biome check --write` nos arquivos em stage + `tsc --noEmit` incremental. Testes **não** rodam no
pre-commit (lentidão faz o time usar `--no-verify`, o que é pior).

---

## 14. Convenções

```
packages/contexts/editorial/
├── src/domain/article.ts
└── tests/
    ├── unit/article.publish.spec.ts          espelha a estrutura de src/
    ├── unit/publish-article.usecase.spec.ts
    ├── integration/prisma-article.repository.spec.ts
    ├── contract/article-repository.contract.ts
    └── builders/article.builder.ts
```

- Sufixo `.spec.ts`. Teste ao lado do contexto que testa, nunca em pasta `__tests__` na raiz.
- Descrições em português; nome do teste é a especificação da regra.
- Proibido `any` em teste — teste também é código de produção do ponto de vista de manutenção.
- Proibido teste condicional (`if` dentro de teste): dois caminhos = dois testes.
- Nada de teste `skip` commitado sem link para a issue que o justifica.

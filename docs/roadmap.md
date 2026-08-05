# Roadmap — Entregas Incrementais

> **Status:** Aprovado em 03/08/2026.
> Cada fase é uma entrega funcional, testada e integrável. Nenhuma fase começa sem sua spec
> aprovada — é a regra do spec-driven development adotada no projeto.

---

## Como cada fase funciona

```
1. Escrever a spec  →  docs/specs/NN-nome.md
2. Você aprova a spec
3. Implementar com testes escritos junto (não depois)
4. CI verde: lint · typecheck · arquitetura · unit · integração · e2e
5. Demonstração do que ficou pronto
6. Próxima fase
```

**A spec de cada fase contém:** objetivo, escopo fechado (com os códigos de `features.md`),
modelo de domínio afetado, casos de uso, contratos de API, telas, casos de teste e critérios de
aceite. **O que não está na spec não é implementado** — mudança de escopo vira nova spec, não
improviso.

**Princípio de ordenação:** cada fase entrega algo demonstrável e é pré-requisito real da
seguinte. Não há fase "de infraestrutura pura" além da Fase 0 — nada é construído "para usar
depois".

---

## Visão geral

| Fase | Entrega | Spec |
|---|---|---|
| **0** | Fundação: Postgres, camadas, testes, CI | `specs/00-fundacao.md` |
| **1** | Identidade & Acesso: papéis e autorização | `specs/01-identidade-acesso.md` |
| **2** | Taxonomia & Mídia: editorias, tags, upload | `specs/02-taxonomia-midia.md` |
| **3** | Editorial: matéria, workflow, agendamento | `specs/03-editorial.md` |
| **4** | Portal público: home, matéria, SEO, ISR | `specs/04-portal-publico.md` |
| **5** | Busca & Distribuição | `specs/05-busca-distribuicao.md` |
| **6** | Engajamento & Analytics | `specs/06-engajamento-analytics.md` |
| **7+** | Evolução contínua | por demanda |

**Fim do MVP = fim da Fase 4.** A partir dali existe um portal operável por uma redação real.
As fases 5 e 6 são melhorias sobre um produto que já funciona.

---

## Fase 0 — Fundação

> **Objetivo:** deixar o repositório pronto para receber domínio, com as regras de arquitetura e
> testes já aplicadas automaticamente. É a fase que evita retrabalho em todas as outras.
>
> ⚠️ **Ordem alterada na prática:** o portal público (Fase 4) foi construído antes desta fase,
> para dar visualização aos casos de uso. Isso acrescenta uma restrição a cada etapa da Fase 0 —
> **não regredir o portal** — e dá ao walking skeleton de testes telas reais para exercitar.
> Detalhes na spec `specs/00-fundacao.md` §2.

**Escopo**

1. **Migração para PostgreSQL** (Decisão 1 de `stack.md`)
   - `provider` do Prisma e do adapter do Better-Auth: `mongodb` → `postgresql`
   - IDs: remover `@map("_id")`, adotar `cuid()`
   - Passar de `db push` para **migrações versionadas** (`prisma migrate`)
   - Validar que o login existente continua funcionando
2. **Ambiente Docker completo** (Decisão 4a) — `docker-compose.yml` com `postgres:17` e
   `redis:7-alpine`, subindo com `pnpm db:start`. É o que garante paridade entre a máquina do dev,
   o CI e a produção. O **Inngest fica fora do compose**: roda pela CLI (`npx inngest-cli dev`) —
   ver `specs/00-fundacao.md` §5.
3. **`packages/shared-kernel`** — `Result`, `AggregateRoot`, `DomainEvent`, `Entity`, `ValueObject`,
   e as portas `Clock`, `IdGenerator`. Deliberadamente mínimo.
4. **Convenção dos bounded contexts documentada** — a estrutura
   `domain/application/infrastructure` fica definida e as regras do
   `dependency-cruiser` são escritas genericamente sobre `packages/contexts/*`, mas os
   pacotes **nascem na fase que os usa**. Oito pacotes vazios seriam código morto a
   manter e compilar sem entregar nada (refinado na spec `specs/00-fundacao.md` §14).
5. **Infraestrutura de testes** — Vitest com workspaces, Testcontainers com Postgres, Playwright,
   builders base, helpers de asserção (`toBeErr`, `toContainEventOfType`).
6. **`dependency-cruiser`** com as regras de `architecture.md` §4 codificadas e falhando o CI.
7. **CI no GitHub Actions** — pipeline de `testing-strategy.md` §13, com cache remoto do Turborepo.
8. **`docs/adr/0001`, `0002` e `0008`** registrados.

**Critérios de aceite**

- [ ] `pnpm test` roda e passa, com pelo menos um teste de cada tipo (unit, integração, e2e)
- [ ] Um import proibido (`domain/` importando Prisma) **quebra o CI** — comprovado por tentativa
- [ ] Container Postgres sobe e é destruído automaticamente no teste de integração
- [ ] CI completo executa em menos de 5 minutos
- [ ] `pnpm install && pnpm db:start && pnpm dev` funciona em máquina limpa, **sem conta em
      nenhum serviço externo** (`N10`)

**Risco:** a migração de banco toca autenticação. Mitigação: fazer antes de existir qualquer dado
real e cobrir o login com E2E ainda nesta fase.

---

## Fase 1 — Identidade & Acesso

> **Status:** ✅ Concluída — ver [`specs/01-identidade-acesso.md`](./specs/01-identidade-acesso.md).
> **Objetivo:** ter usuários de redação com papéis, e a autorização como domínio testável.
> Vem antes de tudo porque *toda* operação editorial depende de "quem pode fazer o quê".

**Escopo:** `A20` a `A27` de `features.md`

- Agregado `StaffMember`, VO `Role`, perfil de autor (`AuthorProfile`)
- Função de autorização pura `can(staff, ação, recurso)` — o coração desta fase
- Better-Auth como adapter de autenticação; autorização **fora** dele
- Layout do painel admin com rotas protegidas por papel
- Convite de usuário, primeiro acesso, desativação
- CRUD de usuários e tela de matriz de permissões

**Critérios de aceite**

- [ ] Matriz de permissões de `features.md` §3.4 coberta por **teste unitário parametrizado**,
      sem HTTP e sem banco
- [ ] Redator autenticado recebe `FORBIDDEN` ao tentar publicar — testado no caso de uso *e* no E2E
- [ ] Usuário desativado perde acesso mas mantém a autoria histórica
- [ ] Cobertura do domínio de identidade ≥ 95%

---

## Fase 2 — Taxonomia & Mídia

> **Status:** ✅ Concluída (2026-08-05) — ver [`specs/02-taxonomia-midia.md`](./specs/02-taxonomia-midia.md).
> **Objetivo:** ter onde classificar e com o que ilustrar a matéria. Precede a Fase 3 porque o
> agregado `Article` exige editoria e capa para publicar.

**Escopo:** `A16` a `A19` e `A28` a `A32`

- Agregados `Section`, `Tag`, `MediaAsset`
- CRUD de editorias (hierarquia de 2 níveis, cor, ordem, desativação em vez de exclusão)
- CRUD e mesclagem de tags
- Porta `MediaStorage` + adapter Cloudflare R2 com upload por URL pré-assinada
- Biblioteca de mídia com legenda, crédito, alt text e ponto focal obrigatórios
- Contrato de teste de `MediaStorage` (fake ↔ R2)

**Critérios de aceite**

- [x] Upload de imagem grande conclui com progresso e sem passar o arquivo pelo servidor da aplicação
- [x] Salvar mídia sem alt text ou sem crédito é **rejeitado pelo domínio**, não só pela interface
- [x] Editoria com matéria publicada não pode ser excluída (mensagem explicativa na UI) — via porta `ContentUsage` (stub até a Fase 3)
- [~] Ponto focal persistido e aplicado (`object-position`); o corte por breakpoint com `next/image` é validado na Fase 4

---

## Fase 3 — Editorial (núcleo do produto)

> **Objetivo:** a redação consegue produzir, revisar, aprovar, agendar e publicar matéria.
> É o **core domain** e a fase que merece mais rigor.

**Escopo:** `A01` a `A15` e `A34`, `A35`

- Agregado `Article` com todas as invariantes de `architecture.md` §2.1
- Máquina de estados do workflow editorial e devolução com motivo
- Corpo em **blocos JSON**, com a lista de blocos do MVP fechada na spec
- Editor **TipTap** com autosave, pré-visualização, validação prévia de publicação e histórico de
  versões — vivendo apenas na camada de interface do admin
- Renderizador de blocos próprio para o portal (o público **não** carrega o TipTap)
- Eventos de domínio + **outbox transacional**
- **Inngest**: portas `EventBus` e `Scheduler`, `packages/jobs` e a função de publicação agendada
  via `step.sleepUntil`
- Dashboard editorial e auditoria

**Critérios de aceite**

- [ ] Toda transição inválida do workflow é rejeitada, com teste unitário para cada uma
- [ ] Publicar sem capa, sem alt text ou sem editoria é bloqueado pelo domínio
- [ ] Matéria agendada é publicada no horário correto — testado com `FixedClock`, sem espera real
- [ ] Entregar o mesmo evento de publicação duas vezes **não** duplica a publicação
- [ ] Slug permanece imutável após a primeira publicação
- [ ] Evento gravado na mesma transação do agregado (comprovado por teste de rollback)
- [ ] `domain/` e `application/` não importam Inngest nem TipTap — verificado pelo
      `dependency-cruiser`
- [ ] Autosave não perde conteúdo em queda de conexão

**Risco encerrado:** a versão anterior deste roadmap registrava o limite de duração do cron da
Vercel como risco do agendamento. Com a adoção do Inngest (Decisão 6), a publicação agendada passa
a ser entrega de evento no horário exato, com durabilidade e retry — o risco deixa de existir.

---

## Fase 4 — Portal público *(fim do MVP)*

> **Objetivo:** o leitor encontra e lê a notícia, com SEO e desempenho de portal profissional.

**Escopo:** `P01` a `P22` e `P24` a `P30`

- Home composta por blocos configuráveis; páginas de editoria, tag e autor
- Página da matéria com renderização dos blocos, relacionadas e compartilhamento
- Busca full-text no Postgres, atrás da porta `ArticleSearchIndex`
- SEO completo: JSON-LD, Open Graph, canonical, sitemaps, `news-sitemap`, RSS
- ISR com invalidação por tag, disparada pelos eventos de publicação via Inngest (com retry — uma
  falha de invalidação não deixa página velha no ar em silêncio)
- Cache Redis para "mais lidas" e blocos da home
- Dark mode e acessibilidade AA validada
- Lighthouse CI com orçamento travando o PR

**Critérios de aceite**

- [ ] Core Web Vitals dentro das metas de `ui-ux.md` §4, medido no CI
- [ ] Nenhuma violação axe de nível A/AA nas páginas públicas
- [ ] JSON-LD de matéria aprovado no Rich Results Test do Google
- [ ] `news-sitemap.xml` contém somente as últimas 48 h
- [ ] Publicar matéria invalida apenas as rotas afetadas — comprovado em teste
- [ ] Portal continua servindo do CDN com o banco indisponível (`N03`)
- [ ] E2E do fluxo completo: redator escreve → editor publica → leitor lê

**➡️ Ao fim desta fase o portal está apto a entrar no ar.**

⚠️ **Pendência que vence aqui:** a Decisão 4b (provedor de produção) precisa estar fechada antes do
go-live desta fase. Até a Fase 3 tudo roda em Docker local e nada depende dela.

---

## Fase 5 — Busca & Distribuição

> **Objetivo:** melhorar descoberta de conteúdo e alcance.

**Escopo:** `P23`, `P32`, `P35`, `A40`

- Substituir o adapter de busca por **Meilisearch** — validado pelo contrato existente, **sem
  escrever teste novo** (é a prova de que a arquitetura cumpriu o prometido)
- Busca com tolerância a erro de digitação, facetas e sugestão enquanto digita
- Newsletter: inscrição, gestão e envio
- Web push para últimas notícias
- Reindexação completa como tarefa administrativa

**Critérios de aceite**

- [ ] `ArticleSearchIndex` trocado sem alteração em `domain/` ou `application/`
- [ ] Contrato de busca passa com Meilisearch exatamente como passava com Postgres
- [ ] Matéria publicada aparece na busca em menos de 30 s
- [ ] Falha do serviço de busca degrada para o Postgres, sem derrubar a página

---

## Fase 6 — Engajamento & Analytics

> **Objetivo:** relacionamento com o leitor e dados para decisão editorial.

**Escopo:** `P31`, `P33`, `A37`, `A38`

- Contexto *Engajamento*: comentários com thread, moderação e denúncia
- Contexto *Audiência*: leitor cadastrado, matérias salvas, editorias seguidas
- Contexto *Analytics*: pageviews, tempo de leitura, origem de tráfego
- Painel de analytics editorial

**Critérios de aceite**

- [ ] Comentário em matéria com comentários desabilitados é rejeitado pelo domínio
- [ ] Profundidade máxima de resposta respeitada
- [ ] Ingestão de pageview não impacta o tempo de resposta da página
- [ ] Moderação em lote funciona sobre fila grande sem degradar

---

## Fase 7+ — Evolução

Sem data definida; entram por prioridade de negócio: cobertura ao vivo, especiais e séries,
editoria de vídeo, PWA, enquetes, relatórios de produção. Cada um com sua spec.

⚪ Paywall permanece fora até haver decisão de modelo de negócio — a arquitetura não impede,
mas não será antecipada.

---

## Riscos monitorados

| Risco | Impacto | Mitigação |
|---|---|---|
| Migração Mongo → Postgres tocar autenticação | Alto | Feita na Fase 0, sem dados reais, com E2E de login |
| ~~Limite de duração do cron da Vercel~~ | — | **Encerrado** pela Decisão 6 (Inngest) |
| **Decisão de produção adiada (4b)** | Médio | Precisa estar fechada **antes do fim da Fase 4**. Como tudo é serviço padrão em Docker, a escolha é de hospedagem, não de tecnologia |
| Escopo do editor TipTap inflar (Fase 3) | Médio | Spec fecha a lista de blocos suportados no MVP; colaboração em tempo real está fora |
| Dependência do Inngest como serviço externo | Médio | Fica atrás das portas `EventBus`/`Scheduler`; dev roda o Dev Server pela CLI (sem conta), o que mantém a opção de self-host em produção |
| Erosão das regras de arquitetura ao longo dos meses | Alto | `dependency-cruiser` no CI desde a Fase 0 |
| Suíte de testes ficar lenta e ser abandonada | Alto | Pirâmide com base ampla e rápida; integração só onde agrega |

---

## O que fica registrado a cada fase

Ao final de cada fase, além do código:

- A spec, atualizada com o que mudou durante a implementação (spec viva, não documento morto)
- ADRs de decisões relevantes tomadas no caminho
- `README` atualizado quando o passo a passo de setup mudar
- `features.md` com os itens entregues marcados

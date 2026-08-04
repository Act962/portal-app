# Spec — Fase 0: Fundação

> **Status:** Aprovada (03/08/2026) — **em execução**. Etapa 1 concluída
> (04/08/2026); Etapa 2 em andamento.
> **Referências:** `../roadmap.md` (Fase 0) · `../architecture.md` §4 e §8 ·
> `../testing-strategy.md` §7, §13 · `../stack.md` (Decisões 1, 4a e 6)

---

## 1. Objetivo

Deixar o repositório pronto para receber domínio, com as regras de arquitetura e
de teste **aplicadas pela ferramenta**, não pela boa vontade de quem revisa.

Ao fim desta fase nenhuma funcionalidade nova é visível para o leitor. O que
muda é que, a partir daqui, um PR que viole a arquitetura ou quebre um teste
**não passa** — e é isso que torna as fases seguintes previsíveis.

Critério de sucesso em uma frase: **um dev novo clona o repositório, roda dois
comandos e tem banco, testes e CI funcionando, sem conta em nenhum serviço.**

---

## 2. Estado atual

O roadmap previa a Fase 0 antes de tudo. Na prática o portal público foi
construído primeiro, para dar visualização aos casos de uso. Isso muda o
contexto desta spec de duas formas:

| | Situação |
|---|---|
| Portal público | **Existe** — 7 rotas, ~40 componentes, alimentado por fixtures em `apps/web/src/data/` |
| Design system | **Existe** — tokens + 7 primitivos em `packages/ui` |
| Banco | MongoDB via Docker, schema só de autenticação (Better-Auth) |
| Migrações | Nenhuma — o projeto usa `prisma db push` |
| Testes | **Nenhum** — sem runner, sem teste |
| CI | **Nenhum** |
| `packages/contexts/` | Não existe |
| `pnpm-workspace.yaml` | Cobre apenas `apps/*` e `packages/*` |

**Consequência para esta fase:** a Fase 0 passa a ter uma restrição que o
roadmap não previa — **não pode regredir o portal**. O build e as 36 páginas
estáticas atuais continuam verdes ao fim de cada etapa. Isso é bom: dá ao
*walking skeleton* de testes algo real para exercitar, em vez de um objeto de
domínio descartável criado só para o teste existir.

---

## 3. Escopo

Sete etapas, na ordem em que devem ser executadas. Cada uma é mergeável sozinha.

| # | Etapa | Depende de | Status |
|---|---|---|---|
| 1 | Migração para PostgreSQL | — | ✅ Concluída |
| 2 | Ambiente Docker completo | 1 | ✅ Concluída |
| 3 | `packages/shared-kernel` | — | ✅ Concluída |
| 4 | Infraestrutura de testes | 1, 2, 3 | ✅ Concluída |
| 5 | `dependency-cruiser` | 3 | 🔜 Próxima |
| 6 | CI no GitHub Actions | 4, 5 | ⬜ Pendente |
| 7 | ADRs | — | ⬜ Pendente |

### Fora de escopo

Registrado para não haver dúvida depois:

- Nenhum agregado, caso de uso ou regra de negócio — isso começa na Fase 1.
- Nenhuma alteração no portal além do necessário para não quebrá-lo.
- Nenhuma substituição das fixtures por queries reais.
- Nenhuma decisão de hospedagem (Decisão 4b segue adiada até a Fase 4).
- Sem Meilisearch, sem R2, sem TipTap — cada um entra na fase que o usa.

---

## 4. Etapa 1 — Migração para PostgreSQL

> **✅ Concluída em 04/08/2026.** Migração aplicada e versionada
> (`migrations/20260803204924_init_auth_postgres`); autenticação validada contra
> o Postgres. **Adendo não previsto na spec:** na sequência o Prisma foi
> atualizado 6.19.3 → 7.9.1. O Prisma 7 é *Rust-free* e o cliente passou a exigir
> um **driver adapter** (`@prisma/adapter-pg` + `pg`); a `url` do datasource saiu
> do `schema.prisma` para o `prisma.config.ts` (`defineConfig`). Registrado no
> commit `chore(db): atualizar Prisma para 7.9.1 com driver adapter`.

Fecha a Decisão 1 de `stack.md`.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `packages/db/prisma/schema/schema.prisma` | `provider = "mongodb"` → `"postgresql"` |
| `packages/db/prisma/schema/auth.prisma` | Remover `@map("_id")` dos 4 modelos |
| `packages/auth/src/index.ts` | `prismaAdapter(prisma, { provider: "postgresql" })` |
| `apps/web/.env` | `DATABASE_URL` no formato `postgresql://` |
| `apps/web/.env.example` | **Criar** — hoje não existe |
| `packages/db/prisma/migrations/` | **Criar** com a migração inicial |

### Sobre os identificadores

O schema atual usa `id String @id @map("_id")`, que é a forma de mapear o `_id`
do Mongo. No Postgres o mapeamento sai e sobra `id String @id`.

Não adicionamos `@default(cuid())` como comportamento principal: **o
Better-Auth gera o id na aplicação** e o envia no insert. Um default no banco
seria letra morta no fluxo real. Ele entra apenas como conveniência para seeds
e inserts manuais, e essa é a razão de estar lá — vale um comentário no schema,
senão alguém remove achando que é redundante.

Os `@@map("user")`, `@@map("session")` etc. permanecem: nomes de tabela em
minúsculas são a convenção do Postgres.

### De `db push` para migrações versionadas

Hoje o fluxo é `prisma db push`, que não deixa histórico. A partir daqui:

- `pnpm db:migrate` (`prisma migrate dev`) passa a ser o caminho oficial;
- `packages/db/prisma/migrations/` é versionado no git;
- `db:push` continua disponível, mas **apenas para prototipagem local** — a
  documentação do `CLAUDE.md` precisa dizer isso, senão alguém o usa em
  produção e o histórico diverge do banco.

### Validação

O único fluxo que hoje toca o banco é a autenticação. É ele que prova a
migração:

1. `pnpm db:start && pnpm db:migrate`
2. Criar conta em `/login`, sair, entrar de novo.
3. Confirmar em `pnpm db:studio` que `user`, `session` e `account` foram
   populados.

Esse fluxo vira o teste E2E da Etapa 4 — assim a validação não depende de
alguém lembrar de repetir isso à mão.

---

## 5. Etapa 2 — Ambiente Docker completo

Fecha a Decisão 4a de `stack.md`. Ajusta `packages/db/docker-compose.yml`, que
após a Etapa 1 já sobe o Postgres, para acrescentar o cache.

### Serviços

| Serviço | Imagem | Porta | Por quê agora |
|---|---|---|---|
| `postgres` | `postgres:17` | 5432¹ | Banco da aplicação |
| `redis` | `redis:7-alpine` | 6379 | Cache e rate limiting (Fase 4) |

¹ Porta do host configurável via `POSTGRES_PORT` (default 5432); localmente
usamos 5433 porque a 5432 já é de outro Postgres na máquina.

O Redis entra já nesta fase mesmo sem consumidor: o objetivo é **um comando sobe
a infraestrutura com estado**. Adicionar serviço depois significa que quem
clonou antes fica com ambiente pela metade e descobre no erro.

### Inngest não é container — é biblioteca + Dev Server

**Decisão (04/08/2026), revisando a Decisão 4a:** o Inngest **sai do
`docker-compose`**. No Next.js ele é uma biblioteca (`inngest`), exposta por um
route handler em `apps/web/src/app/api/inngest/route.ts`; o desenvolvimento
local usa o **Inngest Dev Server pela CLI**, não um container:

- `npx inngest-cli@latest dev` — sobe o Dev Server em `http://localhost:8288`,
  **sem conta e sem chave de API**;
- a app se conecta a ele com `INNGEST_DEV=1`.

Motivo: a integração oficial do Inngest com Next.js é via SDK + Dev Server CLI
([docs](https://www.inngest.com/docs/getting-started/nextjs-quick-start)). Subir
`inngest/inngest` no compose duplicaria o runtime e divergiria do fluxo real de
produção (Inngest Cloud ou self-host, sempre atrás das portas `EventBus` /
`Scheduler`). O `docker-compose` fica só com o que é *stateful* de fato —
Postgres e Redis.

Isso **não antecipa a Fase 3**: o SDK, o client (`apps/web/src/inngest/`) e as
funções nascem lá, quando existe o primeiro job. O que muda aqui é apenas **onde
o Inngest de dev roda** — CLI, não Docker.

### Requisitos

- Healthcheck em cada serviço, para o `db:migrate` não correr antes do Postgres
  aceitar conexão.
- Volumes nomeados, para o banco sobreviver a `db:stop`.
- Nenhuma credencial real: usuário e senha de desenvolvimento fixos no compose e
  espelhados no `.env.example`.
- `container_name` prefixado com `portal-app-`, como já é hoje.

### Paridade

O mesmo `postgres:17` roda em três lugares: máquina do dev, Testcontainers no
CI e produção. É essa paridade que elimina a classe de bug "funciona na minha
máquina" — e é o motivo de fixar a major version em vez de usar `latest`.

---

## 6. Etapa 3 — `packages/shared-kernel`

> **✅ Concluída em 04/08/2026.** Pacote criado com `Result`/`ok`/`err`,
> `Entity`, `ValueObject`, `AggregateRoot`, `DomainEvent` e as portas
> `Clock` (`SystemClock`/`FixedClock`) e `IdGenerator`
> (`UuidGenerator`/`SequentialIdGenerator`). Sem build step, `type: module`,
> exports para TS-source. Verificado por `check-types`, Biome e um smoke test
> de runtime (17 asserções, base dos casos T01–T04).

Primitivas técnicas compartilhadas. Deliberadamente minúsculo: todo shared
kernel tende a inchar e virar acoplamento global disfarçado.

```
packages/shared-kernel/
├── src/
│   ├── result.ts            Result<T, E>, ok(), err()
│   ├── entity.ts            identidade por id
│   ├── value-object.ts      igualdade estrutural
│   ├── aggregate-root.ts    record() / pullEvents()
│   ├── domain-event.ts      contrato do evento
│   ├── ports/
│   │   ├── clock.ts         Clock, SystemClock, FixedClock
│   │   └── id-generator.ts  IdGenerator, UuidGenerator, SequentialIdGenerator
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Regras

- **Zero dependências externas.** É o que garante que o teste de domínio rode
  em milissegundos e que nenhuma quebra de biblioteca alcance a regra de
  negócio.
- **Nenhum conceito de negócio entra aqui.** Nada de `Article`, `Section`,
  `Slug`. Se surgir a tentação, o lugar é um bounded context.
- As implementações de teste (`FixedClock`, `SequentialIdGenerator`) moram no
  próprio pacote, não em `tests/`: são parte do contrato da porta, e é isso que
  torna o determinismo descrito em `testing-strategy.md` §11 disponível para
  todos os contextos sem duplicação.
- **`UuidGenerator` no lugar de `CuidGenerator`** (decisão de 04/08/2026): a
  regra de zero dependências prevaleceu. A implementação de produção usa
  `crypto.randomUUID()` (Web Crypto, embutido), sem lib de cuid. Um adapter cuid
  pode substituí-la depois atrás da mesma porta `IdGenerator`, sem tocar no
  domínio.

### `Result` em vez de exceção

Erro de regra de negócio é resultado esperado, não excepcional — "redator não
pode publicar" não é uma falha do sistema. `Result` força quem chama a tratar,
e é o que permite ao teste afirmar `expect(result).toBeErr(Forbidden)` em vez de
envolver tudo em `try/catch`.

Exceção continua valendo para o que é genuinamente excepcional: banco fora do
ar, invariante interna violada.

---

## 7. Etapa 4 — Infraestrutura de testes

> **✅ Concluída em 04/08/2026.** Vitest com dois *projects* (`unit`/
> `integration`), matchers `toBeErr`/`toContainEventOfType`, Testcontainers e
> Playwright. **Walking skeleton verde:** T01–T04 (12 testes unitários no
> shared-kernel) e T05–T07 (3 de integração com Postgres do Testcontainers, com
> as migrações reais e rollback por transação) rodam com `pnpm test`; T08 (E2E
> da home) passa. **T09** (criar conta → sair → entrar) está escrito, mas
> escreve no banco: roda no CI contra um banco dedicado, não no dev local — o
> *wiring* desse banco de teste fica com a Etapa 6 (CI). Limiares de cobertura
> (§10) estão no `vitest.config.ts`, comentados; o `fail-under` liga na Fase 1.
>
> Comandos: `pnpm test` (unit + integração) · `pnpm test:unit` ·
> `pnpm test:integration` · `pnpm test:e2e` · `pnpm test:coverage`.

### Ferramentas

`vitest`, `@vitest/coverage-v8`, `@testing-library/react`,
`@testing-library/user-event`, `@playwright/test`, `testcontainers`,
`@testcontainers/postgresql`, `msw`, `@faker-js/faker`.

### Organização

Um `vitest.config.ts` na raiz com dois *projects*, porque eles têm custos
muito diferentes e precisam poder rodar separados:

| Project | Escopo | Setup | Alvo |
|---|---|---|---|
| `unit` | `**/tests/unit/**` | nenhum | < 5 s no total |
| `integration` | `**/tests/integration/**` | Testcontainers | < 2 min |

Playwright em config próprio, apontando para o dev server do `apps/web`.

### Walking skeleton

O critério do roadmap pede um teste de cada tipo funcionando. Eles exercitam
**código real**, não um objeto criado para o teste existir:

| Tipo | O que testa | Por que é real |
|---|---|---|
| Unit | `FixedClock`, `Result`, `AggregateRoot.pullEvents()` | Código do `shared-kernel` que a Fase 1 vai usar |
| Integração | Leitura/escrita na tabela `user` com Postgres do Testcontainers | Prova migração, conexão e mapeamento de uma vez |
| E2E | Home renderiza a manchete; fluxo de login | O portal já existe; o login valida a Etapa 1 |

### Isolamento na integração

- Um container por *worker*, reaproveitado entre arquivos. Subir container por
  teste é proibitivo.
- Isolamento por **transação com rollback** ao fim de cada teste — mais rápido
  que truncar tabelas e permite paralelismo.
- Migrações aplicadas uma vez na criação do container, **as mesmas de
  produção**. Montar o schema à mão no teste esconderia erro de migração, que é
  justamente o que queremos pegar.

### Matchers

`toBeErr(ErrorClass)` e `toContainEventOfType(EventClass)`, registrados em um
setup compartilhado. Ambos operam sobre tipos do `shared-kernel`, então já têm
sobre o que atuar nesta fase.

### Cobertura

Limiares de `testing-strategy.md` §10 configurados desde já, mas **sem falhar o
build nesta fase** — com quase nenhum código de domínio, qualquer percentual
seria ruído. O `fail-under` é ligado na Fase 1, junto com o primeiro domínio de
verdade. Isso precisa estar escrito no config, senão parece esquecimento.

---

## 8. Etapa 5 — `dependency-cruiser`

Codifica as regras de `architecture.md` §4 e as executa no CI.

| Regra | Proibição |
|---|---|
| `domain-puro` | `domain/` importar `application/`, `infrastructure/` ou **qualquer pacote externo** |
| `application-limitada` | `application/` importar `infrastructure/` |
| `infra-nao-vaza` | camada de interface (`apps/web`) importar `infrastructure/` de um contexto |
| `contextos-isolados` | um contexto importar outro que não por sua interface publicada |
| `sem-ciclos` | dependência circular entre módulos |

A regra `domain-puro` é a mais valiosa e a menos intuitiva: ela barra até
`import { z } from "zod"`. É o que mantém o domínio testável sem I/O e imune a
quebra de biblioteca.

**Validação obrigatória da etapa:** abrir um PR de teste que adicione um import
proibido e confirmar que o CI **reprova**. Regra que nunca foi vista falhando
não é garantia, é decoração.

---

## 9. Etapa 6 — CI no GitHub Actions

Pipeline de `testing-strategy.md` §13.

```
push / pull_request
  ├── setup: pnpm install + cache
  ├── (paralelo) lint · typecheck · arquitetura · unit
  ├── integração (serviços em container)
  ├── build
  └── e2e (Playwright)
```

### Decisões

- **Cache do Turborepo via `actions/cache`**, não remote cache. O remote cache
  exige conta e token, e a Decisão 4b está adiada — não vamos criar dependência
  de fornecedor numa fase cujo lema é "sem conta em serviço nenhum".
- `concurrency` com `cancel-in-progress`, para push seguido não enfileirar
  execuções obsoletas.
- Artefatos de falha do Playwright (trace, vídeo, screenshot) publicados no job.
- `TZ=America/Sao_Paulo` fixado no ambiente do CI — o portal tem lógica sensível
  a horário e o runner roda em UTC por padrão.
- **Branch protection em `main`** exigindo os jobs verdes. Sem isso o pipeline é
  sugestão, não regra.

### Meta

Pipeline completo abaixo de **5 minutos**. Se passar disso, a causa mais
provável é o job de integração subindo container mais de uma vez — investigar
antes de aumentar o limite.

---

## 10. Etapa 7 — ADRs

Formalizam decisões já tomadas e justificadas em `stack.md` e
`architecture.md`, no formato de `docs/adr/README.md`.

| ADR | Título |
|---|---|
| `0001` | Monólito modular em vez de microsserviços |
| `0002` | PostgreSQL como banco principal |
| `0008` | Docker Compose como ambiente de desenvolvimento padrão |

Os ADRs `0003`–`0007` são escritos nas fases que os materializam.

---

## 11. Casos de teste

| # | Caso | Tipo | Etapa |
|---|---|---|---|
| T01 | `FixedClock` devolve sempre o mesmo instante | Unit | 3 |
| T02 | `SequentialIdGenerator` gera ids previsíveis | Unit | 3 |
| T03 | `Result.err` não é tratado como sucesso | Unit | 3 |
| T04 | `pullEvents()` esvazia a fila do agregado | Unit | 3 |
| T05 | Migrações aplicam num Postgres limpo | Integração | 4 |
| T06 | Escrita e leitura na tabela `user` | Integração | 4 |
| T07 | Rollback isola um teste do seguinte | Integração | 4 |
| T08 | Home renderiza a manchete | E2E | 4 |
| T09 | Criar conta, sair e entrar novamente | E2E | 4 |
| T10 | Import proibido reprova o CI | Arquitetura | 5 |

---

## 12. Critérios de aceite

- [ ] `pnpm install && pnpm db:start && pnpm dev` funciona em máquina limpa,
      **sem conta em nenhum serviço externo** (requisito `N10`)
- [ ] `pnpm test` passa, com pelo menos um teste de cada tipo (T01–T09)
- [ ] Container Postgres sobe e é destruído automaticamente no teste de
      integração, sem passo manual
- [ ] Um import de `domain/` para Prisma **quebra o CI** — comprovado por
      tentativa (T10)
- [ ] Pipeline completo executa em menos de 5 minutos
- [ ] `pnpm build` segue verde e o portal continua gerando as 36 páginas
- [ ] Login funciona contra o Postgres, com dados visíveis no `db:studio`
- [ ] `migrations/` versionado no git
- [ ] ADRs 0001, 0002 e 0008 escritos
- [ ] `CLAUDE.md` atualizado: `db:migrate` como caminho oficial, `db:push` só
      para prototipagem

---

## 13. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Migração tocar autenticação | Alto | Feita agora, sem dados reais, coberta por E2E (T09) na mesma fase |
| `pnpm-workspace.yaml` não cobrir `packages/contexts/*` | Médio | Ajustar o glob junto com a Etapa 3, antes do primeiro contexto existir |
| Testcontainers exigir Docker no CI | Médio | Runner `ubuntu-latest` já traz Docker; documentar como pré-requisito local |
| Suíte nascer lenta e ser abandonada | Alto | Projects separados: quem desenvolve roda só `unit`, em segundos |
| Migração quebrar o portal sem ninguém notar | Médio | `pnpm build` é critério de aceite de **cada etapa**, não só do fim |

---

## 14. Refinamentos em relação ao roadmap

Dois pontos onde esta spec diverge de `roadmap.md`, com o motivo:

1. **O roadmap pede "esqueleto dos bounded contexts" (item 4).** Esta spec cria
   apenas o `shared-kernel` e ajusta o workspace glob. Criar oito pacotes vazios
   agora produz código morto que precisa ser mantido e compilado sem entregar
   nada; as regras do `dependency-cruiser` são escritas de forma genérica sobre
   `packages/contexts/*` e passam a valer no instante em que o primeiro contexto
   aparecer, na Fase 1. **A convenção de pastas fica documentada, os pacotes
   nascem quando têm conteúdo.**

2. **O roadmap não previa que o portal já existiria.** Isso vira vantagem: o
   E2E do walking skeleton exercita telas reais, e "não regredir o portal"
   entra como critério de aceite de cada etapa.

Se estes refinamentos forem aprovados, `roadmap.md` deve ser atualizado para
refletir a nova ordem e o item 4 revisado.

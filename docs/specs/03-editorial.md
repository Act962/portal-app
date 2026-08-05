# Spec — Fase 3: Editorial (núcleo do produto)

> **Status:** ✅ Aprovada (2026-08-05) — decisões D1–D7 confirmadas conforme
> recomendado, **com a ressalva de D3/D4**: o Inngest é apenas um adapter atrás
> das portas `EventBus`/`Scheduler`; a aplicação nunca fica presa a ele e pode
> trocar por um despacho síncrono ou por `node-cron` sem tocar domínio/aplicação
> (ver §5.1). Em execução.
> **Referências:** `../roadmap.md` (Fase 3) · `../architecture.md` §2.1 e §5 ·
> `../features.md` §3.1–§3.2 (A01–A15) e A34/A35 · `../stack.md` (Decisão 5 —
> editor; Decisão 6 — Inngest) · `01-identidade-acesso.md` e
> `02-taxonomia-midia.md` (padrões reusados).

---

## 1. Objetivo

Fazer a redação **produzir, revisar, aprovar, agendar e publicar** matéria. É o
**core domain** — a razão de ser do produto — e a fase que merece mais rigor. Ela
amarra o que já existe: a matéria referencia **editoria** (Fase 2), **capa de
mídia** (Fase 2) e **autor** (Fase 1), e publica sob **autorização** (Fase 1).

Critério de sucesso em uma frase: **uma matéria percorre o workflow
`RASCUNHO → EM_REVISÃO → APROVADA → AGENDADA → PUBLICADA`, só publica com título,
corpo, editoria e capa-com-alt-text (regra de domínio), e a agendada publica
sozinha no horário — testado com relógio fixo, sem espera real.**

---

## 2. Estado atual

| | Situação |
|---|---|
| Contextos | `identity`, `taxonomy`, `media` prontos e provados; `editorial` **não existe** |
| Portal público | Renderiza de **fixtures** (`apps/web/src/data/`) — continua até a Fase 4 |
| Editoria "em uso" | `taxonomy` tem a porta `ContentUsage` (stub `StubNoUsage`) — **a Fase 3 a implementa de verdade** |
| Eventos | `shared-kernel` tem `DomainEvent` e `AggregateRoot.pullEvents()`; **não há bus nem outbox** |
| Agendamento | Inexistente; a Decisão 6 escolheu **Inngest** (lib + Dev Server, não Docker) |
| Editor | Inexistente; a Decisão 5 (TipTap) está **em aberto** — esta fase a fecha |

**Consequência:** a fase constrói o contexto `editorial` inteiro (domínio →
aplicação → infra → API → admin), liga os eventos de domínio a um **outbox
transacional** despachado pelo Inngest, e implementa o agendamento durável.

---

## 3. Escopo — `A01`–`A15`, `A34`, `A35`

Sete etapas, na ordem de execução. Cada uma é mergeável sozinha; da Etapa 4 em
diante já há algo demonstrável.

| # | Etapa | Entrega | Demo? |
|---|---|---|---|
| 1 | Domínio do `Article` | Agregado + VOs (`Headline`,`Slug`,`Kicker`,`Standfirst`,`Body`/blocos,`Byline`,`EditorialStatus`,`PublicationSchedule`), máquina de estados, invariantes de publicação, eventos de domínio; testes de cada transição | — |
| 2 | Persistência + `ContentUsage` real | Prisma (`article`, blocos, relação com `section`/`media`/autor), repositório (porta/adapter/fake + contrato), **adapter que implementa `ContentUsage` da taxonomia** | — |
| 3 | Casos de uso do workflow | `createDraft`, `submitForReview`, `rejectWithReason`, `approve`, `publish`, `unpublish/archive` — autorizados por `can(...)`; router tRPC | — |
| 4 | Admin: lista + editor de blocos | Lista com filtros (A10), **editor TipTap** (blocos do MVP), autosave (A06), pré-visualização (A08); renderizador de blocos próprio | ✅ |
| 5 | Eventos: outbox + Inngest | Portas `EventBus`/`Scheduler`, outbox transacional, `packages/jobs`, relay → Inngest; idempotência por chave | ✅ |
| 6 | Agendamento | `schedule`/`reschedule`/`cancel` (A12/A14), publicação durável via `step.sleepUntil` (A13), calendário (A15) | ✅ |
| 7 | Fecho | Dashboard editorial (A34), auditoria imutável (A35), ADRs 0003/0005/0007, cobertura, depcruise, E2E redator→editor | ✅ |

### Fora de escopo (Fase 4)

- **Portal público** renderizando as matérias reais (home/editoria/matéria), SEO,
  ISR, feeds — a Fase 3 entrega a **pré-visualização** no admin, não o portal.
- Busca full-text (porta `ArticleSearchIndex`) — Fase 4.
- Histórico de versões **comparar/restaurar visual** (A07): ver D6.

---

## 4. Contexto Editorial — `packages/contexts/editorial`

```
domain/
├── article.ts            agregado raiz (máquina de estados + invariantes)
├── editorial-status.ts   RASCUNHO|EM_REVISAO|APROVADA|AGENDADA|PUBLICADA|ATUALIZADA|ARQUIVADA
├── headline.ts kicker.ts standfirst.ts byline.ts   VOs de texto
├── slug.ts               VO (reuso do padrão da taxonomia; imutável após publicar)
├── body.ts + blocks/     Body = lista de blocos; união discriminada por tipo
├── publication-schedule.ts   VO (só futuro; fuso America/Sao_Paulo)
├── cover.ts              referência à mídia (id + alt-text) — capa
├── errors.ts             InvalidTransition, CoverImageRequired, AltTextRequired, SectionRequired, ...
├── events/               ArticlePublished, ArticleScheduled, ArticleRejected, ...
└── ports/
    ├── article-repository.ts
    ├── event-bus.ts       publishAll(events)
    └── scheduler.ts       schedulePublish(articleId, at) / cancel(articleId)
application/               um caso de uso por transição (orquestra, sem regra)
infrastructure/           Prisma, outbox, adapter Inngest, adapter ContentUsage p/ taxonomia
```

- **`Article`** guarda os invariantes de `architecture.md` §2.1: não publica sem
  título, corpo e editoria; não publica sem **capa com alt-text**; `slug` único e
  **imutável após a primeira publicação**; só agenda para o futuro; publicada não
  se apaga, arquiva-se; **transições válidas apenas**.
- **`publish(now)`** é a regra pura de `architecture.md` §5 — devolve `Result`
  com a lista de pendências, não exceção.
- **Eventos** são gravados via `record(...)` e entregues por `pullEvents()` **na
  mesma transação** do save (outbox).

### Blocos do corpo (fecha A01/`Body`)

União discriminada `{ type, ... }`, validada no domínio. MVP proposto (D1):
`paragraph`, `heading` (h2/h3), `image` (referencia um `MediaAsset`), `list`
(ordenada/não), `quote`, `embed` (URL de vídeo/post). O portal tem **renderizador
próprio** desses blocos (o público não carrega o editor).

---

## 5. Eventos, outbox e Inngest (Etapas 5–6)

- **Outbox transacional (ADR 0005):** o caso de uso salva o agregado e grava os
  eventos (`pullEvents()`) **na mesma transação** Prisma; um relay os despacha
  depois. Elimina o "salvou mas não indexou".
- **Inngest (ADR 0007):** o relay entrega ao Inngest, que faz retry com backoff,
  passos duráveis e **idempotência por chave** (A13). Agendamento por
  `step.sleepUntil` — sem cron varrendo tabela.
- **Determinismo:** o domínio usa a porta `Clock`; o teste de agendamento usa
  `FixedClock` (sem espera real). `domain/` e `application/` **não importam
  Inngest nem TipTap** — barrado pelo `dependency-cruiser`.

### 5.1 O Inngest é substituível (restrição de projeto)

O Inngest **nunca** é referenciado pela aplicação nem pelo domínio — só existe
como **um** adapter das portas `EventBus` e `Scheduler`, instanciado na raiz de
composição (`packages/api`). A qualquer momento pode ser trocado por:

- **Despacho síncrono** — um `EventBus` que chama os consumidores em processo, na
  hora (bom para dev, testes e cargas pequenas); um `Scheduler` que publica
  imediatamente quando `at <= now`.
- **`node-cron` (ou similar)** — um `Scheduler` que varre o outbox/agenda e
  publica no horário, sem Inngest.

Por isso cada porta ganha **pelo menos dois adapters já nesta fase** — um fake
in-memory/síncrono (usado nos testes e default de dev) e o de Inngest — provando
na prática que a troca é só mudar a linha da composição. O outbox é o **ponto de
costura**: os eventos são persistidos independentemente de quem os despacha, então
trocar o despachante não perde evento. Esta é uma **restrição explícita**: manter
o núcleo agnóstico de Inngest vale mais que qualquer conveniência que o acople.

---

## 6. Decisões (confirmadas 2026-08-05)

Todas aprovadas conforme a recomendação. **Ajuste em D3/D4:** o Inngest é um
adapter substituível (§5.1), nunca uma dependência do núcleo.

- **D1 — Corpo em blocos JSON (ADR 0003)** _(recomendado)_. Corpo como lista de
  blocos JSON tipados, não HTML — dá renderização controlada, segura (sem
  `dangerouslySetInnerHTML`) e portável. Blocos do MVP: `paragraph`, `heading`,
  `image`, `list`, `quote`, `embed`. Novos blocos entram sem migração de schema.
- **D2 — Editor TipTap na camada de interface (fecha a Decisão 5)**
  _(recomendado)_. TipTap (headless, sobre ProseMirror) **só no admin**, emitindo
  os blocos JSON do D1. O domínio e o portal não o conhecem. Alternativa
  (Lexical) descartável depois sem tocar o domínio, pois o contrato é o JSON.
- **D3 — Outbox transacional + Inngest como adapter substituível (ADRs
  0005/0007)** _(recomendado, com ressalva)_. Como `architecture.md` §5. Portas
  `EventBus`/`Scheduler` com **múltiplos adapters** (síncrono/in-memory + Inngest);
  o núcleo é agnóstico (§5.1). O Dev Server do Inngest é CLI (`npx inngest-cli
  dev`), **não** container (coerente com o ADR 0008).
- **D4 — Agendamento atrás da porta `Scheduler`; Inngest via `step.sleepUntil`
  como um adapter** _(recomendado, com ressalva)_. O agendamento é durável e
  idempotente (A13). O adapter Inngest usa `step.sleepUntil`; um adapter
  `node-cron` ou síncrono cumpre a mesma porta sem tocar o núcleo (§5.1).
- **D5 — `editorial` implementa a porta `ContentUsage` da taxonomia**
  _(recomendado)_. Fecha o D2 da Fase 2: "editoria em uso não se exclui" passa a
  ser real. O adapter vive na infra do `editorial` e é injetado na composição —
  taxonomia **não** passa a depender de editorial (a seta continua correta).
- **D6 — Histórico de versões mínimo nesta fase** _(recomendado)_. Autosave grava
  **snapshots** (A06/A07-parcial: ver e restaurar); o **diff visual** de versões
  fica para um polimento posterior. Edição concorrente (A09) via **versão
  otimista** (aviso de conflito), não lock.
- **D7 — Auditoria (A35) derivada dos eventos de domínio** _(recomendado)_. O log
  imutável de publicação/edição/permissão é um **consumidor** do outbox, não uma
  escrita paralela — uma fonte da verdade só.

---

## 7. Casos de teste (amostra)

| # | Caso | Tipo | Etapa |
|---|---|---|---|
| E01 | Cada transição inválida do workflow é rejeitada | Unit | 1 |
| E02 | Publicar sem capa / sem alt-text / sem editoria é bloqueado (pendências listadas) | Unit | 1 |
| E03 | `slug` imutável após a primeira publicação | Unit | 1 |
| E04 | Devolução exige motivo (`EM_REVISAO → RASCUNHO`) | Unit | 1/3 |
| E05 | Contrato `ArticleRepository` fake↔Prisma | Integração | 2 |
| E06 | `ContentUsage` real: editoria com matéria publicada não se exclui | Integração | 2 |
| E07 | Evento gravado na MESMA transação do agregado (teste de rollback) | Integração | 5 |
| E08 | Entregar o mesmo `ArticlePublished` duas vezes não duplica | Integração | 5 |
| E09 | Agendada publica no horário — `FixedClock`, sem espera | Unit/Integr. | 6 |
| E10 | E2E: redator escreve e submete → editor publica | E2E | 7 |

---

## 8. Critérios de aceite (do roadmap)

- [ ] Toda transição inválida do workflow é rejeitada, com teste unitário por transição
- [ ] Publicar sem capa, sem alt-text ou sem editoria é bloqueado pelo domínio
- [ ] Matéria agendada é publicada no horário correto — testado com `FixedClock`
- [ ] Entregar o mesmo evento de publicação duas vezes **não** duplica a publicação
- [ ] `slug` permanece imutável após a primeira publicação
- [ ] Evento gravado na mesma transação do agregado (comprovado por teste de rollback)
- [ ] `domain/` e `application/` não importam Inngest nem TipTap — verificado pelo `dependency-cruiser`
- [ ] Autosave não perde conteúdo em queda de conexão
- [ ] Cobertura do domínio editorial ≥ 95%

---

## 9. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Escopo do editor TipTap inflar | Médio | Lista de blocos do MVP fechada no D1; colaboração em tempo real fora |
| Outbox e Inngest serem complexos | Alto | Portas + fakes primeiro (Etapa 5 testável sem Inngest); Inngest só no adapter |
| Acoplar `editorial`→`taxonomy`/`media` errado | Alto | Referência por id + alt-text (VO `Cover`); `contextos-isolados` no CI |
| Agendamento não-determinístico | Alto | Porta `Clock` + `FixedClock`; `step.sleepUntil` idempotente |
| Fase muito grande travar a apresentação | Médio | Etapas 1–4 já entregam criar→revisar→publicar demonstrável antes de Inngest |

---

## 10. ADRs previstos

- **0003** — Corpo da matéria em blocos JSON em vez de HTML (D1).
- **0005** — Outbox transacional para eventos de domínio (D3).
- **0007** — Despacho de eventos e agendamento atrás de portas; Inngest como
  adapter substituível (não uma amarra) — `node-cron`/síncrono como alternativas
  drop-in (D3/D4, §5.1).

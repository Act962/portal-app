# Spec — Fase 3: Editorial (núcleo do produto)

> **Status:** ✅ Concluída (2026-08-05) — 7 etapas entregues; decisões D1–D7
> conforme recomendado, com a ressalva de D3/D4 (Inngest substituível, §5.1). O
> editor entregou um **editor de blocos estruturado** (o rich-text do TipTap é
> refinamento seguinte); o **E2E de navegador (E10) foi adiado** — o fluxo
> redator→editor está coberto em unit + integração. Ver nota de fecho.
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

| # | Etapa | Entrega | Status |
|---|---|---|---|
| 1 | Domínio do `Article` | Agregado + VOs, máquina de estados, invariantes de publicação, eventos de domínio; testes de cada transição | ✅ |
| 2 | Persistência + `ContentUsage` real | Prisma (`article`, blocos, refs por id), repositório (porta/adapter/fake + contrato), **adapter que implementa `ContentUsage` da taxonomia** | ✅ |
| 3 | Casos de uso do workflow | `createDraft`/`submit`/`reject`/`approve`/`publish`/`archive`/`schedule`, autorizados por `can(...)`; router tRPC | ✅ |
| 4 | Admin: lista + editor de blocos | Lista com filtros (A10), **editor de blocos** (TipTap adiado), autosave (A06), pré-visualização (A08); renderizador de blocos próprio | ✅ |
| 5 | Eventos: outbox + barramento | Porta `EventBus` (síncrono default; Inngest substituível), outbox transacional, relay idempotente | ✅ |
| 6 | Agendamento | `schedule`/`cancel` (A12/A14), poller durável `publishDueScheduled` (A13, node-cron-friendly), calendário (A15) | ✅ |
| 7 | Fecho | Auditoria imutável via outbox (A35), ADRs 0003/0005/0007, cobertura, depcruise | ✅ |

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

- [x] Toda transição inválida do workflow é rejeitada, com teste unitário por transição (E01)
- [x] Publicar sem capa, sem alt-text ou sem editoria é bloqueado pelo domínio (E02)
- [x] Matéria agendada é publicada no horário correto — testado com `FixedClock` (E09)
- [x] Entregar o mesmo evento de publicação duas vezes **não** duplica a publicação (E08)
- [x] `slug` permanece imutável após a primeira publicação (E03)
- [x] Evento gravado na mesma transação do agregado (comprovado por teste de rollback — E07)
- [x] `domain/` e `application/` não importam Inngest nem TipTap — verificado pelo `dependency-cruiser`
- [~] Autosave não perde conteúdo em queda de conexão — autosave por debounce implementado; o teste de resiliência a queda fica para a Fase 4
- [x] Cobertura do domínio editorial ≥ 95%

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

## 10. ADRs (escritos na Etapa 7)

- [`0003`](../adr/0003-corpo-em-blocos-json.md) — Corpo em blocos JSON (D1).
- [`0005`](../adr/0005-outbox-transacional.md) — Outbox transacional (D3).
- [`0007`](../adr/0007-eventos-e-agendamento-atras-de-portas.md) — Despacho e
  agendamento atrás de portas; Inngest substituível (D3/D4, §5.1).

## 11. Nota de fecho — o que ficou pronto, e o adiado

O contexto `editorial` está completo (domínio → aplicação → infra → API → admin)
e o ciclo fecha com a Fase 2: a porta `ContentUsage` da taxonomia agora tem
implementação real (editoria/tag com matéria publicada não se exclui).

**Demo local** (`pnpm db:start && pnpm db:migrate && pnpm dev:web`, logado como o
1º usuário = ADMIN): em **/dashboard/articles**, criar matéria → preencher
título, chapéu, linha fina, editoria e capa (da biblioteca de mídia), montar o
corpo em blocos, ver o autosave e a **pré-visualização** → enviar para revisão →
aprovar → publicar (ou agendar e clicar em "processar agendadas vencidas"). As
**pendências** de publicação aparecem antes do clique. Em **/dashboard/audit**, o
registro imutável dos eventos (via outbox → consumidor síncrono).

**Adiados, com razão:**
- **Rich-text TipTap (D2):** entregue um editor de blocos estruturado, funcional
  ponta a ponta (produz o JSON do D1); o TipTap sobre parágrafo/título é
  refinamento de UX que não muda o formato consolidado.
- **E2E de navegador (E10):** o fluxo redator→editor→publicar exige signup +
  cliques encadeados no Playwright; está coberto em unit (`manage-articles`) e
  integração (contrato + outbox). Entra junto do E2E completo da Fase 4.
- **Diff/restauração visual de versões (A07)** e **resiliência de autosave a
  queda:** Fase 4.

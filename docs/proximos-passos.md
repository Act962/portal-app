# Próximos passos — estado e continuação

> **Atualizado:** 2026-08-05. Ponto de retomada do desenvolvimento.
> Este arquivo é o "onde paramos e o que falta". As specs por fase
> (`docs/specs/`) continuam sendo a fonte de verdade de escopo.

---

## 1. Onde estamos

| Fase | Estado | Spec |
|---|---|---|
| 0 — Fundação | ✅ Concluída | `specs/00-fundacao.md` |
| 1 — Identidade & Acesso | ✅ Concluída | `specs/01-identidade-acesso.md` |
| 2 — Taxonomia & Mídia | ✅ Concluída | `specs/02-taxonomia-midia.md` |
| 3 — Editorial | ✅ Concluída | `specs/03-editorial.md` |
| 4 — Portal público | 🚧 **Em andamento** (Etapas 1–2 de 7 feitas) | `specs/04-portal-publico.md` |
| 5 — Busca e distribuição | ⬜ Não iniciada | (spec futura) |
| 6 — Engajamento e Analytics | ⬜ Não iniciada | (spec futura) |

**MVP funcional hoje:** o ciclo completo redação→leitor funciona — criar
editoria/tags, subir mídia (upload direto, ponto focal), escrever matéria em
blocos, workflow (rascunho→revisão→aprovada→publicada, com agendamento e
auditoria), e o portal público renderizando as publicadas (home, editoria,
matéria com blocos + capa por ponto focal, últimas, busca). **CI verde nas 6
checagens.**

---

## 2. O que falta na Fase 4 (Etapas 3–7)

Ordem sugerida; cada etapa é mergeável e verificável.

### Etapa 3 — Autor, tag, menu, paginação
- [ ] Página de autor `/autor/{slug}` (P10): ligar no `AuthorProfile` do
      contexto `identity` (bio/foto/cargo — E-E-A-T). Hoje `getAuthor` no read
      model só deriva o nome do slug (`apps/web/src/data/read-model.ts`).
- [ ] Página de tag `/tag/{slug}` (P09): rota nova em `(site)`, lista por tag.
- [ ] Navegação/menu completo (P11) e **paginação por cursor** (P12) — hoje a
      paginação é por offset (`@/lib/pagination`).

### Etapa 4 — SEO
- [ ] JSON-LD `NewsArticle` + `BreadcrumbList` + `Organization` (P24) — já há
      `@/lib/structured-data` e `@/components/seo/json-ld`; revisar/validar no
      Rich Results Test.
- [ ] Open Graph/Twitter com a **capa pelo ponto focal** como imagem OG (P25).
- [ ] `sitemap.xml` por editoria (P26), `news-sitemap.xml` só das últimas 48 h
      (P27, ≤1.000 URLs), **RSS** geral e por editoria (P28).

### Etapa 5 — ISR + cache (o fio com o outbox)
- [ ] Etiquetar rotas (`article:{id}`, `section:{slug}`, `home`) e trocar os
      loaders resilientes/dinâmicos por **ISR com `revalidateTag`**.
- [ ] **Novo consumidor do outbox** (irmão da auditoria, em
      `packages/api/src/editorial.ts`) que chama `revalidateTag` em
      `ArticlePublished`/`Updated`/`Unpublished` (P30). Com retry.
- [ ] **Redis** para "mais lidas" (P05, janela 24 h, com fallback) e cache de
      blocos da home. **Redis padrão via `ioredis` + `REDIS_URL`** — sem Upstash
      (ver `memory` do projeto e spec §5.1/D4). Container já sobe no `db:start`.

### Etapa 6 — Busca full-text
- [ ] Porta `ArticleSearchIndex` + adapter **Postgres full-text**
      (`to_tsvector`/`ts_rank`). Hoje `searchArticles` é `includes` em memória
      (read model). Indexação como **consumidor do outbox**.
- [ ] Filtros por editoria/autor/período (P21); estado vazio útil (P22).

### Etapa 7 — Fecho
- [ ] **`next/image`** com AVIF/WebP (P15/A32) — hoje a capa/imagens usam `<img>`
      com `object-position` (o corte focal já funciona; falta a otimização por
      host). Precisa de `images.remotePatterns` em `next.config.ts` para o host
      do S3_PUBLIC_URL (MinIO/R2).
- [ ] **Lighthouse CI** (Core Web Vitals) + **axe** (a11y AA) travando o PR.
- [ ] **E2E completo** redator→editor→leitor (Q12) e "portal serve com o banco
      fora" (Q11/N03).
- [ ] **ADR de hospedagem** fechando a Decisão 4b: Vercel + Postgres gerenciado +
      **Redis auto-hospedável** + R2. Código provider-agnóstico (tudo atrás de
      portas).

---

## 3. Itens adiados (com razão) — dívida consciente

| Item | Fase | Razão | Onde retomar |
|---|---|---|---|
| **Rich-text TipTap** (D2) | 3 | Entregue editor de blocos estruturado, funcional ponta a ponta; TipTap é refino de UX que não muda o formato de blocos | `apps/web/.../articles/[id]/article-editor.tsx` + `components/editorial/block-editor.tsx` |
| **E2E de navegador** M12 (upload), E10 (redator→editor) | 2/3 | Exigem signup + upload/cliques encadeados; fluxo coberto em unit + contratos de integração | juntar no E2E da Fase 4 (Q12) |
| **Diff/restauração visual de versões** (A07) | 3 | Autosave por snapshot entregue; diff visual é peso extra | Fase 4/pós-MVP |
| **Resiliência de autosave a queda** | 3 | Autosave por debounce entregue; teste de resiliência a queda de conexão | Fase 4 |
| **Editor visual de layout da home** (P06 pleno) | 4 | Home compõe por recência + ordem das editorias; marcação de manchete/destaque explícita fica para depois | Fase 4/6 |
| **Gate de lint (`biome ci`)** | 0 | Scaffold não foi formatado com Biome; ligar junto da limpeza do repo | `.github/workflows/ci.yml` §24 (comentado) |
| **Branch protection no `main`** | 0 | A conta `JGabriel963` tem `admin:false` em `Act962/portal-app` | precisa de owner (`Act962`) rodar `gh api`/UI |

---

## 4. Notas técnicas para retomar (evitam re-descoberta)

- **Docker é pré-requisito** para dev, testes de integração e o demo:
  `pnpm db:start` sobe Postgres + Redis + **MinIO** (bucket `portal-media`
  criado sozinho por um init container).
- **Gate exato do CI** (rodar antes de commitar mudança de código):
  `pnpm test:coverage` (unit + integração, com fail-under de domínio ≥95%).
  Complementos: `pnpm check-types`, `pnpm depcruise`, `pnpm build`.
- **Read model público** (`apps/web/src/data/read-model.ts`): RSC-only, só
  publicadas, denormalizado, `cache()` por request, **tolerante a banco
  ausente** (função `safely` → vazio). `data/queries.ts` é a costura: os
  componentes importam dela; ela delega ao read model. Só `displayTimestamp` e
  `sortArticles` seguem síncronos.
- **Build sem banco:** o job de `build` do CI NÃO tem Postgres — os loaders
  resilientes fazem o build passar com dados vazios. Ao introduzir **ISR**
  (Etapa 5), decidir entre dar um Postgres ao job de build ou manter dinâmico.
- **E2E precisa de conteúdo:** o job de `e2e` semeia uma matéria publicada via
  `packages/db/prisma/seed-e2e.sql` (rodado com `psql -f`, porque
  `prisma db execute` não aceita `--url` no Prisma 7 — a URL vive em
  `prisma.config.ts`). Novos testes de portal dependem desse seed.
- **Migrações:** com Docker de pé, use `pnpm db:migrate` (`prisma migrate dev`).
  Sem Docker, dá para escrever o SQL da migração à mão em
  `packages/db/prisma/migrations/<timestamp>_<nome>/migration.sql` (foi assim
  na Fase 2, validado depois pelo CI).
- **Restrições de projeto (memória):**
  - **Inngest é substituível** — despacho/agendamento atrás das portas
    `EventBus`/`Scheduler`; o default é síncrono/in-process; `node-cron`/Inngest
    são adapters. Núcleo nunca importa Inngest.
  - **Infra auto-hospedável, sem SaaS proprietário** — Redis padrão (`ioredis` +
    `REDIS_URL`, VPS do cliente), não Upstash. Tudo por env/portas.
- **Composition root** em `packages/api` (mantém `infra-nao-vaza`): a cola entre
  contextos vive lá (ex.: `EditorialContentUsage` implementa a porta
  `ContentUsage` da taxonomia; o consumidor de auditoria; futuros consumidores de
  ISR/busca).

---

## 5. Demo (loop completo)

```bash
pnpm db:start && pnpm db:migrate && pnpm dev:web
```

Logado (o **1º usuário nasce ADMIN**): `/dashboard` → criar editoria e subir uma
imagem → escrever matéria em blocos com capa → publicar → abrir o portal (`/`) e
ver a matéria no ar, com a imagem cortada pelo ponto focal. `/dashboard/audit`
mostra os eventos.

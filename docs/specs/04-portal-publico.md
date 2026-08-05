# Spec — Fase 4: Portal público (fim do MVP)

> **Status:** ✅ Aprovada (2026-08-05) — decisões D1–D7 conforme recomendado,
> **com ajuste em D4/D7**: nada de Upstash. O Redis é padrão (via `ioredis` +
> `REDIS_URL`), auto-hospedável no VPS do cliente ou em qualquer gerenciado —
> atrás de porta, sem lock-in de SaaS (mesmo princípio da porta do Inngest). Em
> execução.
> **Referências:** `../roadmap.md` (Fase 4) · `../ui-ux.md` (SEO, performance,
> telas) · `../features.md` §4 (P01–P30) · `../stack.md` (Decisão 2 — busca;
> Decisão 3 — R2; Decisão 4b — hospedagem, **vence nesta fase**) ·
> `03-editorial.md` (a fonte dos dados agora).

---

## 1. Objetivo

O leitor **encontra e lê** a notícia, com o desempenho e o SEO de um portal
profissional. É o **fim do MVP**: ao fim desta fase o portal está apto a entrar
no ar. A matéria que a redação publica na Fase 3 aparece no portal, indexável
pelo Google, rápida e acessível.

Critério de sucesso em uma frase: **publicar uma matéria no admin a faz surgir
no portal em segundos (ISR por evento), com JSON-LD válido, imagem cortada pelo
ponto focal e Core Web Vitals no verde — servida do CDN mesmo com o banco fora.**

---

## 2. Estado atual

| | Situação |
|---|---|
| Portal `(site)` | Existe e renderiza de **fixtures** (`apps/web/src/data/`), lido por `data/queries.ts` |
| A costura | `data/queries.ts` é a **camada de leitura**: os componentes já importam só dela, nunca das fixtures — foi desenhada para a Fase 4 trocar o corpo por queries reais **sem tocar componente** |
| Conteúdo real | O contexto `editorial` já produz matérias publicadas (corpo em blocos, capa com ponto focal, editoria, tags, autor) |
| Eventos | O outbox já emite `ArticlePublished`/`Updated`/`Unpublished`; hoje só a auditoria consome — a invalidação de ISR será um novo consumidor |
| Redis | Container de pé desde a Fase 0, **sem consumidor** — passa a ser usado aqui (mais lidas, cache) |
| Busca | Inexistente; a Decisão 2 escolheu **Postgres full-text no MVP**, Meilisearch na Fase 5, atrás da porta `ArticleSearchIndex` |
| Hospedagem | Decisão 4b **adiada**; tudo roda em Docker local. Vence aqui (o time já iniciou o setup Vercel) |

**Consequência:** a fase constrói uma **camada de leitura pública** (read model)
sobre o banco, liga o portal a ela, e adiciona SEO, ISR, busca e desempenho — sem
reescrever os componentes do `(site)`.

---

## 3. Escopo — `P01`–`P22` e `P24`–`P30`

Sete etapas. Da Etapa 1 o portal já mostra dados reais.

| # | Etapa | Entrega | Status |
|---|---|---|---|
| 1 | Read model público | Serviço de leitura sobre o banco (só publicadas, denormalizado) que substitui o corpo de `data/queries.ts`; home, editoria, últimas ligadas ao real | — |
| 2 | Página da matéria | Renderização dos blocos no público, capa com ponto focal (`next/image`), cabeçalho editorial, tempo de leitura, relacionadas (P17), compartilhamento (P16), data de atualização (P18) | — |
| 3 | Autor, tag, menu, paginação | `/autor/{slug}` (P10), `/tag/{slug}` (P09), navegação (P11), paginação por cursor (P12) | — |
| 4 | SEO | JSON-LD `NewsArticle`+`BreadcrumbList`+`Organization` (P24), OG/Twitter (P25), canonical, `sitemap.xml` (P26), `news-sitemap.xml` (P27), RSS (P28) | — |
| 5 | ISR + cache | Invalidação por `revalidateTag` disparada pelos eventos do outbox (P30); Redis para mais lidas (P05) e blocos da home | — |
| 6 | Busca | Porta `ArticleSearchIndex` + adapter Postgres full-text (P20), filtros (P21), estado vazio útil (P22) | — |
| 7 | Fecho | Performance (Core Web Vitals, Lighthouse CI), a11y AA (axe), E2E completo redator→editor→leitor, ADRs, cobertura | — |

### Fora de escopo

- **Meilisearch / busca tolerante a erro (P23)** — Fase 5, atrás da mesma porta.
- **Comentários, newsletter, leitor cadastrado, ao vivo, push, PWA** (P31–P39) —
  pós-MVP.
- **Composição da home 100% gerenciável sem deploy (P06)** — nesta fase a ordem
  vem das editorias (ordem já editável na Fase 2) + manchete/destaques marcados;
  um editor de layout visual da home fica para depois (ver D6).

---

## 4. Read model público — a peça central

O portal **não** consulta o `ArticleRepository` do admin (que devolve rascunhos e
o agregado inteiro). Ganha uma **camada de leitura própria** (CQRS-lite): só
matérias **publicadas**, em forma **denormalizada e cacheável** (capa já com URL
pública, autor já com nome/slug, editoria já com nome).

- Vive como um serviço de leitura (`packages/api`, lado servidor) com a MESMA
  assinatura de `data/queries.ts` — trocar `@/data/queries` pelo serviço real é
  mudar o import, não os componentes (a costura já existe).
- Lê direto no Postgres (Prisma) com projeções enxutas; o `(site)` é todo RSC,
  então chama o serviço no servidor, **sem tRPC nem React Query** (a regra do
  grupo `(site)` continua: nada de providers no portal).
- URLs seguem `/{editoria}/{slug}` (P29). O slug é **imutável após publicar**
  (invariante do domínio, Fase 3), então não há necessidade de tabela de
  redirect 301 para mudança de título — ver D5.

---

## 5. SEO, performance e acessibilidade

- **JSON-LD** (P24): `NewsArticle` (headline, datePublished/Modified, imagem
  ≥1200px, autor, editora), `BreadcrumbList`, `Organization`. Validado no Rich
  Results Test.
- **Social** (P25): Open Graph + Twitter Card por página; a imagem OG é a capa
  pelo ponto focal.
- **Feeds** (P26–P28): `sitemap.xml` particionado por editoria, `news-sitemap.xml`
  só das últimas 48 h (≤1.000 URLs), RSS geral e por editoria.
- **Imagem** (P15): `next/image` com AVIF/WebP e dimensões explícitas (sem CLS),
  **corte pelo ponto focal** guardado na Fase 2 (`object-position`). É aqui que a
  A32, adiada na Fase 2, se materializa.
- **Core Web Vitals**: LCP <2,5s, INP <200ms, CLS <0,1 (`ui-ux.md` §4), medido no
  **Lighthouse CI** travando o PR.
- **A11y AA**: sem violação axe A/AA; dark mode sem "flash" (P07); foco visível,
  landmarks, hierarquia de headings, `prefers-reduced-motion`.

---

## 6. ISR, invalidação e cache

- **ISR + `revalidateTag`** (P30): cada rota pública é etiquetada (`article:{id}`,
  `section:{slug}`, `home`). Um **novo consumidor do outbox** — irmão da
  auditoria — chama `revalidateTag` ao receber `ArticlePublished`/`Updated`/
  `Unpublished`, invalidando **só as rotas afetadas**. Falha de invalidação tem
  retry (não deixa página velha no ar em silêncio).
- **Redis** (P05): contadores de "mais lidas" (24 h) e cache de blocos da home,
  com **fallback** quando o cache está frio. Atrás de uma porta, adapter
  `ioredis` apontando para um `REDIS_URL` — **Redis padrão, auto-hospedável** (o
  container da Fase 0 no dev; um Redis no VPS do cliente ou gerenciado em
  produção). Sem SDK/serviço proprietário: nada de lock-in.
- **N03** (resiliência): o portal serve do CDN mesmo com o banco indisponível —
  ISR entrega a última versão estática.

---

## 7. Busca

- Porta **`ArticleSearchIndex`** (`index(article)`, `search(query, filtros)`),
  adapter **Postgres full-text** (`to_tsvector` sobre título+linha fina+corpo+
  tags, ranqueado por `ts_rank`). Meilisearch entra na Fase 5 pela mesma porta.
- A indexação é mais um **consumidor do outbox** (publica → indexa), coerente
  com o resto. Filtros por editoria/autor/período (P21); estado vazio sugere
  termos e mostra mais lidas (P22).

---

## 8. Decisões (confirmadas 2026-08-05)

Todas aprovadas conforme a recomendação, **com ajuste em D4/D7**: Redis padrão
auto-hospedável (via `ioredis` + `REDIS_URL`), sem Upstash nem qualquer SaaS
proprietário — atrás de porta, no mesmo espírito da porta do Inngest.

- **D1 — Read model separado (CQRS-lite)** _(recomendado)_. O portal lê por um
  serviço próprio (só publicadas, denormalizado, cacheável), não pelo repositório
  do admin. Mantém a regra RSC do `(site)` e a costura de `data/queries.ts`.
- **D2 — Invalidação de ISR como consumidor do outbox** _(recomendado)_. Reusa o
  barramento da Fase 3: um handler chama `revalidateTag` nos eventos de
  publicação. Nada de "salvou mas não revalidou".
- **D3 — Busca Postgres full-text atrás de porta** _(recomendado)_. `ts_vector`/
  `ts_rank` no MVP; Meilisearch (P23, Fase 5) troca o adapter sem tocar as telas.
- **D4 — Mais lidas em Redis PADRÃO, com fallback** _(recomendado, ajustado)_.
  Contador por matéria (janela 24 h) + top-5; cache frio cai para "recentes".
  Atrás de porta, adapter `ioredis` sobre `REDIS_URL` — **Redis auto-hospedável**
  (VPS do cliente ou gerenciado), **sem Upstash** nem SDK proprietário.
- **D5 — Sem tabela de redirect 301** _(recomendado)_. O slug é imutável após a
  primeira publicação (domínio, Fase 3), então mudar o título não muda a URL —
  P29 já está satisfeito pela invariante, sem infra de redirect.
- **D6 — Composição da home pela ordem das editorias + marcações**
  _(recomendado)_. Manchete e destaques são marcados na matéria; a ordem dos
  blocos vem da ordem das editorias (editável na Fase 2). Um editor visual de
  layout da home (P06 pleno) fica para depois — não bloqueia o MVP.
- **D7 — Fechar a Decisão 4b: Vercel + Postgres gerenciado + Redis padrão
  (auto-hospedável) + R2** _(recomendado, ajustado)_. Alinha ao setup já iniciado.
  **Sem Upstash**: o Redis é padrão, apontado por `REDIS_URL` — pode subir no VPS
  do cliente. Todo o código fica **provider-agnóstico** (ISR/Redis/R2/busca atrás
  de portas), então trocar de provedor (ou auto-hospedar) não é reescrita.

---

## 9. Casos de teste (amostra)

| # | Caso | Tipo | Etapa |
|---|---|---|---|
| Q01 | Read model devolve só publicadas, denormalizadas | Integração | 1 |
| Q02 | Home/editoria/últimas renderizam do banco real | E2E | 1 |
| Q03 | Blocos e capa (ponto focal) renderizam na matéria | Unit/E2E | 2 |
| Q04 | Tempo de leitura e relacionadas corretos | Unit | 2 |
| Q05 | Paginação por cursor estável com acervo grande | Integração | 3 |
| Q06 | JSON-LD `NewsArticle`+`BreadcrumbList` válidos | Unit | 4 |
| Q07 | `news-sitemap` só das últimas 48 h (≤1.000) | Unit/Integr. | 4 |
| Q08 | Publicar invalida **só** as rotas afetadas | Integração | 5 |
| Q09 | Mais lidas com fallback de cache frio | Integração | 5 |
| Q10 | Busca full-text ordena por relevância; filtros | Integração | 6 |
| Q11 | Portal serve com o banco fora (ISR/CDN, N03) | E2E | 7 |
| Q12 | E2E: redator escreve → editor publica → leitor lê | E2E | 7 |
| Q13 | Core Web Vitals no verde; zero violação axe A/AA | CI | 7 |

---

## 10. Critérios de aceite (do roadmap)

- [ ] Core Web Vitals dentro das metas de `ui-ux.md` §4, medido no CI
- [ ] Nenhuma violação axe A/AA nas páginas públicas
- [ ] JSON-LD de matéria aprovado no Rich Results Test
- [ ] `news-sitemap.xml` contém somente as últimas 48 h
- [ ] Publicar matéria invalida apenas as rotas afetadas — comprovado em teste
- [ ] Portal continua servindo do CDN com o banco indisponível (N03)
- [ ] E2E do fluxo completo: redator escreve → editor publica → leitor lê

---

## 11. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Read model divergir do admin (matéria "some") | Alto | Read model consome os MESMOS eventos; testes Q01/Q08; publicadas são a única fonte |
| ISR não invalidar e servir página velha | Alto | Invalidação via outbox com retry (D2); teste Q08 |
| Portal RSC ganhar providers e vazar devtools | Médio | Regra do grupo `(site)` mantida (nada de React Query no portal); read model é server-side |
| Core Web Vitals regredirem sem alarme | Médio | Lighthouse CI travando o PR (Q13) |
| Busca Postgres não escalar | Baixo (MVP) | Porta `ArticleSearchIndex`; Meilisearch troca o adapter na Fase 5 |
| Decisão 4b (provedor) atrasar o go-live | Alto | D7 fecha agora; código provider-agnóstico não bloqueia |

---

## 12. ADRs previstos

- **Read model público separado do modelo de escrita (CQRS-lite)** (D1).
- **Provedor de produção: Vercel + Postgres gerenciado + Redis padrão
  auto-hospedável + R2** (D7, fecha a Decisão 4b; sem lock-in de SaaS) — número
  na sequência, escrito na Etapa 7.

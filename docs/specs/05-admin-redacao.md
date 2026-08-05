# Spec — Fase 5: Painel da redação (UI do dashboard)

> **Status:** ✅ Aprovada (2026-08-05) — decisões D1–D4 confirmadas pelo cliente.
> Em execução.
> **Referências:** `../roadmap.md` (Fase 5) · `../ui-ux.md` §7 (telas do painel) ·
> `../features.md` §3 (painel administrativo) · `../adr/0003-corpo-em-blocos-json.md`
> (que já previa o TipTap) · `../adr/0010-inline-nodes-no-corpo.md` (emenda desta fase) ·
> `01-identidade-acesso.md` (papéis e `can()`) · `03-editorial.md` (workflow).

---

## 1. Objetivo

A redação **opera o portal inteiro com conforto**, e o produto fica apresentável a
um cliente. As fases 0–4 construíram um backend maduro — workflow editorial de seis
estados, RBAC, outbox/auditoria, upload com ponto focal, portal público com SEO
completo — mas a interface do painel nunca saiu do walking skeleton.

Critério de sucesso em uma frase: **um repórter entra no painel, escreve uma matéria
com texto formatado e imagens, e a publica — sem tocar em nenhum controle improvisado,
em tema claro ou escuro, e o dono da operação consegue convidar a equipe e vender
espaço publicitário.**

---

## 2. Estado atual

| | Situação |
|---|---|
| Shell | `apps/web/src/app/(app)/layout.tsx` é provisório — o próprio comentário diz "o admin real substitui este shell na Fase 1". Não existe sidebar |
| Navegação | 5 links sublinhados numa `<nav>` dentro de `/dashboard/page.tsx`. **De uma subpágina não há como ir para outra** |
| Design system | **Zero** componentes `@portal-app/ui` usados dentro de `(app)/**`. Tudo é `<input className="rounded border px-2 py-1">` e `<table>` cru, repetido 6× |
| Editor | `block-editor.tsx` é um formulário por bloco (textareas + botões ↑↓✕). Não é rich-text: **negrito, itálico e link no meio do parágrafo são impossíveis** |
| Tema | Dark mode está completo no CSS (`.dark` + tokens `--sidebar-*`) e **desligado em runtime** por `forcedTheme="light"` |
| Chrome | `header.tsx`, `user-menu.tsx`, `sign-in-form.tsx` são scaffold Better-T-Stack **em inglês** ("Welcome Back", "Sign Out") |
| Backend | Maduro. `editorial.*`, `taxonomy.*`, `media.*`, `identity.*` cobrem quase tudo que a UI precisa |
| Lacunas de backend | **Não existe** convite de membro, reativar membro, configurações do site nem banners/anúncios |

**Dois defeitos de autorização encontrados na análise** (corrigidos na Etapa 2, ver §6):

1. `packages/api/src/routers/taxonomy.ts:66,109` expõem `sections.list` e `tags.list`
   sob `requirePermission("taxonomy:manage")`, que **só ADMIN** tem. Na prática
   **REDATOR e EDITOR abrem qualquer matéria e recebem FORBIDDEN**, com o select de
   editoria vazio — e editoria é pendência de publicação. Dois dos três papéis não
   conseguem publicar.
2. `packages/api/src/routers/editorial.ts:185` — `audit.list` usa `staffProcedure` em
   vez de `requirePermission("audit:view")`. Qualquer membro ativo lê a auditoria pela
   rede, mesmo com a página redirecionando.

---

## 3. Escopo

Três blocos de entrega. **Ao fim do bloco A o produto já é demonstrável a um cliente.**

### Bloco A — Shell, editor e mídia

| # | Etapa | Entrega |
|---|---|---|
| A1 | Design system | Primitivos que faltam (sidebar, table, dialog, sheet, tabs, select, command, calendar…) vindos do registry `base-lyra` |
| A2 | Correções de autorização | Os dois defeitos do §2 + primeiros testes de router do repo |
| A3 | Shell e tema | Sidebar colapsável, topbar com breadcrumb e busca, navegação filtrada por `can()`, **dark/light ligado** |
| A4 | Inline nodes | O corpo passa a carregar formatação inline (D1) |
| A5 | Editor TipTap | Rich-text que emite os blocos do domínio |
| A6 | Biblioteca de mídia | Upload múltiplo com arrastar-e-soltar, ponto focal, seletor reusável |
| A7 | Tela da matéria | Duas colunas, sidebar de publicação com pendências, workflow, agendamento, tags |
| A8 | Lista de matérias | Tabela com filtros na URL, badges de status, estados de carregamento e vazio |
| A9 | Taxonomia, membros, auditoria | Re-skin nos primitivos novos |
| A10 | Polimento | pt-BR no chrome de autenticação, `⌘K`, teclado, contraste AA nos dois temas |

### Bloco B — Equipe e configurações

Convite de membro por link (D2), reativação, e configurações do site (`settings:manage`
existe como permissão desde a Fase 1, sem nada atrás).

### Bloco C — Banners

Campanhas com imagem, link, posição e período (D3). O `AdSlot` do portal, hoje um
placeholder estático, passa a servir campanha real.

### Fora de escopo

- **Histórico visual de versões e diff** — dívida registrada desde a Fase 3.
- **Aviso de edição concorrente** (dois jornalistas na mesma matéria) — precisa de
  versionamento otimista no agregado; fica para uma fase própria.
- **Métricas de impressão/clique dos banners** — o Bloco C entrega veiculação; medição
  é módulo à parte (precisa de rota de tracking, agregação e cuidado com cache).
- **Editor visual de layout da home (P06 pleno)** — segue como está.
- **Paginação por cursor (P12)** — dívida já registrada; entra no Bloco B junto com
  `limit`/`cursor` no `articles.list`.

---

## 4. Decisões

### D1 — RichText estende os blocos com nós inline

**Escolhido:** `paragraph`, `heading` e `quote` passam a carregar `InlineNode[]`
(`text`/`strong`/`em`/`link`) em vez de `string`; `list.items` vira `InlineNode[][]`.

| Alternativa | Por que não |
|---|---|
| Guardar o JSON do TipTap direto | Quebra o ADR 0003: o domínio perderia a validação por bloco, o portal ficaria acoplado ao formato do editor e trocar de editor viraria migração |
| Manter texto puro, TipTap só visual | Não seria "RichText completo" — negrito e link no meio do parágrafo continuariam impossíveis |

O ADR 0003 já previa isto: *"o editor (TipTap) vive só na camada de interface do admin
e emite esse JSON"*. E o renderizador do portal **já** suporta `strong` e `link`
(`InlineNode` em `apps/web/src/data/types.ts`) — só o domínio não carregava.
Registrado no **ADR 0010**.

### D2 — Convite por link copiável, sem e-mail

**Escolhido:** o dono gera um convite (e-mail + papel + validade); a UI mostra um link
com token para copiar e enviar pelo canal que quiser.

Enviar por e-mail exigiria SMTP ou um SaaS de e-mail — e a restrição de projeto é
**infra auto-hospedável, sem lock-in** (a mesma que rejeitou o Upstash na Fase 4). O
envio automático pode entrar depois atrás de uma porta `Mailer`, sem retrabalho.

**Consequência de segurança:** hoje `resolveStaff` provisiona **qualquer** usuário
autenticado como membro (o primeiro vira ADMIN). Com convites isso vira brecha —
passa a provisionar **só** com convite válido, exceto o primeiro do sistema.

### D3 — Banners são campanhas com período e posição

**Escolhido:** agregado `Campaign` com imagem, link, posição
(`HEADER`/`SIDEBAR`/`IN_CONTENT`/`ANCHOR`), período de veiculação e ativo/inativo.

Um banner fixo por posição seria mais rápido, mas o cliente pediria agendamento na
primeira campanha vendida. Métricas ficam de fora (ver §3).

### D4 — Entrega faseada, demo vendável primeiro

O Bloco A é o que torna o portal apresentável e permite publicar com conforto; B e C
são módulos novos de backend. Cada etapa é mergeável e verificável.

### D5 — O tema do admin usa só a escala shadcn

Os tokens de marca (`bg-canvas`, `text-ink`, `border-hairline`) existem **só em light**
— não têm variante `.dark`. No painel usa-se apenas a escala neutra do shadcn
(`bg-background`, `bg-card`, `bg-sidebar`, `text-muted-foreground`), que é theme-aware.
`brand-red` é a única cor de marca legível nos dois temas e fica reservada ao CTA de
publicar. O portal público segue **sempre claro** e nunca carrega `next-themes`.

---

## 5. O editor — a peça central

O TipTap vive **só na camada de interface** (`apps/web`), como manda o ADR 0003. O
contrato com o resto do sistema é o formato de blocos, não o editor.

```
TipTap (ProseMirror doc)  ⇄  serialize.ts  ⇄  Block[]  →  Body.create()  →  domínio
```

`serialize.ts` é um módulo **puro, sem JSX**, com testes de round-trip
(`docToBlocks(blocksToDoc(b)) ≡ b`). Três regras não óbvias moram nele:

1. **Descartar blocos vazios.** `Body.create` rejeita parágrafo sem texto, e o TipTap
   **sempre** mantém um parágrafo vazio no fim do documento. Sem esse filtro, **todo
   autosave falharia**.
2. **Achatar marks combinados** (`link > strong > em > text`). Negrito dentro de link
   não sobrevive ao round-trip — perda consciente, documentada no ADR 0010.
3. **Normalizar quebras de linha** para espaço.

**Leitura tolerante, escrita estrita.** O `Body` ganha duas portas: `create()`
normaliza e valida (erro é erro); `fromRaw()` normaliza e descarta o irrecuperável,
nunca falha. O repositório passa a usar `fromRaw` — assim toda matéria no formato
antigo cura na leitura, e o autosave cura na base no primeiro save. O read model
público precisa da **mesma tolerância**, porque lê o JSON do Prisma sem passar pelo
domínio.

Não há migração de schema: `Article.body` já é `Json`. O backfill é um script
idempotente, rodado por higiene.

---

## 6. Critérios de aceite

| # | Critério |
|---|---|
| Q01 | Um REDATOR consegue escolher editoria e tags numa matéria (prova o fix do §2.1) |
| Q02 | Um EDITOR recebe FORBIDDEN ao chamar `audit.list` pela rede |
| Q03 | De qualquer subpágina do painel é possível navegar para qualquer outra |
| Q04 | A navegação mostra só o que o papel pode acessar (`can()` no servidor) |
| Q05 | O painel funciona em tema claro e escuro; **o portal público continua claro** depois de visitar o painel no escuro |
| Q06 | O painel é operável em tela de celular (sidebar vira gaveta) |
| Q07 | Negrito, itálico e link funcionam dentro do parágrafo, e aparecem no portal |
| Q08 | Uma matéria no formato antigo continua sendo lida e renderizada corretamente |
| Q09 | O autosave não falha com o documento terminando em parágrafo vazio |
| Q10 | Publicar fica **bloqueado** enquanto houver pendências, com o motivo visível |
| Q11 | Upload de várias imagens de uma vez, com progresso e ponto focal |
| Q12 | Crédito e texto alternativo são exigidos com mensagem que **explica por quê** |
| Q13 | A lista de matérias filtra por status, editoria, autor e busca, com o filtro na URL |
| Q14 | Ciclo completo rascunho→revisão→aprovada→publicada, e a matéria aparece no portal |
| Q15 | (Bloco B) O dono convida alguém por link; a pessoa aceita e entra com o papel certo |
| Q16 | (Bloco B) Sem convite válido, um novo cadastro **não** vira membro |
| Q17 | (Bloco C) Uma campanha no ar aparece na posição certa do portal; fora do período, não |

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| O parágrafo vazio do TipTap quebra todo autosave | Filtro em `docToBlocks`, com teste |
| O CLI do shadcn sobrescreve os 24 componentes existentes | Rodar em blocos pequenos, sem `--overwrite`, conferindo `git status` |
| Puxar Radix e fragmentar o design system | O kit é **Base UI**; usar só o registry `base-lyra` |
| O React Compiler mata a reatividade da toolbar | `useEditorState` + `"use no memo"` + `immediatelyRender: false` |
| O tema escuro vazar para o portal público | `Providers` só em `(app)`; link para o site é `<a target="_blank">` |
| O portal perder parágrafos silenciosamente na migração | Tolerância ao formato antigo **em duplicata**: domínio e read model |
| Reformatação em massa pelo Biome | Formatar só os arquivos tocados |

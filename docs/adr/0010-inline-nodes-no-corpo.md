# 0010 — Formatação inline no corpo da matéria

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decisores:** Equipe do portal-app
- **Emenda a:** [0003 — Corpo da matéria em blocos JSON](0003-corpo-em-blocos-json.md)

## Contexto

O ADR 0003 fixou o corpo como lista de blocos JSON validados no domínio, e já
antecipava o editor: *"o editor (TipTap) vive só na camada de interface do admin e
emite esse JSON"*. Faltava, porém, o que um jornalista usa o tempo todo: **negrito,
itálico e link no meio de um parágrafo**.

Hoje `paragraph` é `{ type: "paragraph"; text: string }` — texto puro. Não há como
marcar um trecho. Curiosamente, o portal público **já está pronto** para receber
formatação: `apps/web/src/data/types.ts` define `InlineNode` com `text`/`strong`/`link`
e `article-body.tsx` os renderiza. O que falta é o domínio carregar essa informação.

## Alternativas consideradas

- **Guardar o documento do TipTap (ProseMirror) direto.** Zero código de mapeamento e
  todo recurso do editor sai de graça. Mas revoga o ADR 0003 na prática: o domínio
  perde a validação por bloco, o portal passa a depender do formato do editor, e
  trocar de editor vira migração de conteúdo — exatamente o acoplamento que o 0003
  evitou.
- **Manter texto puro e usar o TipTap só como UX.** Entrega rápida, sem migração. Mas
  não resolve o problema: continuaria impossível marcar um trecho.
- **Estender os blocos com nós inline (escolhido).**

## Decisão

Os blocos que contêm texto passam a carregar uma **lista de nós inline** em vez de uma
string:

```ts
export type InlineNode =
  | { type: "text";   text: string }
  | { type: "strong"; text: string }
  | { type: "em";     text: string }
  | { type: "link";   text: string; href: string };
```

`paragraph`, `heading` e `quote` trocam `text: string` por `content: InlineNode[]`;
`list.items` passa de `string[]` para `InlineNode[][]`. Os blocos sem texto (`image`,
`embed`) não mudam.

Três decisões de detalhe:

**Discriminante `type`, não `kind`.** O domínio já usa `type` nos blocos; misturar os
dois no mesmo arquivo confundiria. O `InlineNode` do portal (camada de leitura) segue
com `kind`, e o read model traduz — assim o tipo público e os componentes do `(site)`
não mudam de forma.

**`list.items` promovido agora.** Custa poucas linhas a mais e evita uma **segunda**
migração de conteúdo depois.

**Marks combinados são achatados.** ProseMirror permite `marks: [bold, link]` no mesmo
nó de texto; nosso `InlineNode` é uma união plana, com precedência
`link > strong > em > text`. Negrito dentro de um link não sobrevive ao round-trip.
É perda consciente: um modelo aninhado complicaria domínio, validação e renderizador
para um ganho editorial marginal.

### Leitura tolerante, escrita estrita

O `Body` passa a ter duas portas com semânticas explícitas:

- `Body.create(blocks): Result<Body, InvalidBlock>` — normaliza **e valida**. Usada na
  escrita; erro é erro.
- `Body.fromRaw(raw: unknown): Body` — normaliza e descarta o irrecuperável. **Nunca
  falha.** Usada ao reidratar da persistência.

A normalização aceita o formato antigo: `text: string` vira `[{ type: "text", text }]`.
O repositório Prisma, que hoje faz um cast cego (`row.body as Block[]`), passa a usar
`fromRaw` — assim toda matéria antiga cura na leitura, e o autosave cura na base no
primeiro save. **A leitura do conteúdo nunca pode explodir por formato velho**, porque
é o portal público que serve esse conteúdo.

O read model público (`apps/web/src/data/read-model.ts`) precisa da **mesma tolerância**
em duplicata, porque lê o JSON do Prisma sem passar pelo domínio.

## Consequências

- **Mais fácil:** o jornalista formata o texto como espera; o ADR 0003 continua de pé
  (blocos tipados, validados no domínio, renderizados sem `dangerouslySetInnerHTML`);
  o portal já sabia renderizar `strong`/`link`.
- **Mais difícil / a monitorar:** um tipo de bloco agora toca domínio, serializador do
  editor e dois renderizadores de forma coordenada; a normalização adiciona ramos ao
  `body.ts`, que está sob gate de cobertura ≥95%; e o serializador do TipTap precisa
  **descartar blocos vazios** — o editor sempre mantém um parágrafo vazio no fim do
  documento, e `Body.create` o rejeita, então sem esse filtro todo autosave falharia.
- **Sem migração de schema:** `Article.body` já é uma coluna `Json`. O backfill é um
  script idempotente, rodado por higiene, não por correção.

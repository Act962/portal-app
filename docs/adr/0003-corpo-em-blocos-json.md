# 0003 — Corpo da matéria em blocos JSON em vez de HTML

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decisores:** Equipe do portal-app

## Contexto

A matéria precisa de um corpo rico (parágrafos, títulos, imagens, listas,
citações, embeds) editável no admin e renderizado no portal. A escolha do
formato de armazenamento é cara de reverter: muda o editor, o renderizador, a
migração de conteúdo e a superfície de segurança.

## Alternativas consideradas

- **HTML salvo direto.** Simples de renderizar (`dangerouslySetInnerHTML`), mas
  abre XSS, mistura conteúdo com apresentação, dificulta reprocessar (ex.: trocar
  o markup de imagem em todas as matérias) e prende ao editor que o gerou.
- **Markdown.** Melhor que HTML, mas ainda é texto a re-parsear, e blocos ricos
  (imagem com crédito, embed, ponto focal) viram convenções frágeis.
- **Blocos JSON tipados (escolhido).** O corpo é uma lista de blocos, cada um um
  objeto com `type` e campos próprios — dado estruturado, não markup.

## Decisão

O corpo é uma **lista de blocos JSON** (`Body` no domínio), união discriminada
por `type`. No MVP: `paragraph`, `heading` (h2/h3), `image` (referencia um
`MediaAsset`), `list`, `quote`, `embed`. Cada bloco é **validado no domínio**
(`Body.create` → `Result`), não no editor. O portal tem um **renderizador
próprio** desses blocos; o público nunca carrega o editor. Novos blocos entram
sem migração de schema (é uma coluna `Json`).

O **editor (TipTap)** vive só na camada de interface do admin e emite esse JSON —
trocá-lo por outro editor não toca domínio nem portal, porque o contrato é o
formato de blocos, não o editor.

## Consequências

- **Mais fácil:** renderização controlada e segura (sem `dangerouslySetInnerHTML`);
  reprocessar/versionar conteúdo; validar o corpo como invariante; o público não
  baixa o editor.
- **Mais difícil / a monitorar:** é preciso escrever e manter o renderizador de
  blocos (feito nesta fase, reusado na Fase 4); adicionar um tipo de bloco exige
  tocar domínio + editor + renderizador de forma coordenada.

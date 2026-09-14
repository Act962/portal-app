# Spec — Fase 10: Editor profissional de artes (Konva) e variáveis

> **Status:** 🚧 Em validação — F1 a F5 implementadas em 14/09/2026; falta a
> validação do cliente no editor. Decisões do cliente em 14/09/2026 (D1–D4).
> **Operação:** o `skia-canvas` baixa um binário nativo no `install`
> (`allowBuilds` no `pnpm-workspace.yaml`). Ambiente sem acesso ao GitHub
> Releases no build precisa do binário por outro caminho.
> **Substitui:** o editor de padrões e o desenhista da `09-padroes-de-arte.md`
> (F3 e F4 de lá). O resto da 09 continua valendo: padrão por destino (D10),
> cópia do desenho no post (D9/D18), arte como cache (D8), permissões (D11),
> publicação a partir da matéria (F6).
> **Referência de UX:** o Catálogo Promocional do nerp-2
> (`apps/web/src/features/promotional-catalog`) e o editor de capas do Book
> (`apps/web/src/features/books/components/cover-editor`, este já em Konva).

---

## 1. Objetivo

**O designer do veículo monta o padrão num editor de verdade, e a redação só
preenche o que o padrão deixou preencher.**

O editor da 09 era uma prévia do servidor com caixas HTML por cima: cada ajuste
pedia um PNG novo, não havia rotação, seleção múltipla, guias, desfazer, nem
texto com variável. O cliente reprovou (14/09): "precisa de um editor
profissional para os nossos designers".

Critério de sucesso: **um designer reproduz a arte "ÚLTIMAS" do cliente —
moldura PNG, foto com degradê, pílula, título dinâmico, botão com texto fixo —
sem sair do editor e sem ajuda, e a arte publicada é pixel a pixel a do editor.**

---

## 2. Decisões

**D1 — Konva nos dois lados.** *(cliente, 14/09)* O editor desenha com Konva no
navegador; o servidor desenha a MESMA cena com Konva + `skia-canvas`
(`konva/skia-backend`). O código que transforma o padrão em nós Konva é um só
(`@portal-app/art-scene`), usado pelos dois. Isso mantém a promessa da 09 ("o
que você viu é o que foi ao ar") e o rascunho automático com arte (09, D2), que
roda sem ninguém com a tela aberta. O Satori, o resvg e o `sharp` do desenho
saem.

Provado em 14/09 (Windows, Node 24): Montserrat 800 itálico a partir do `.woff`
do `@fontsource`, acentos e quebra por palavra, 1080×1350 em ~4 s a frio.

**D2 — Texto com variáveis `{{chave}}`.** *(cliente, 14/09)* O conteúdo de uma
caixa é texto livre com marcadores: `{{titulo}}`, `Leia em {{editoria}}`. Há
dois tipos de variável:

- **Do sistema**, vindas da matéria: `titulo`, `subtitulo`, `chapeu`,
  `editoria`, `autor`, `site`, `data`.
- **Do padrão**, criadas pelo designer: chave, rótulo, valor padrão, e se aceita
  várias linhas. Ex.: `{{chamada}}`, "Chamada do botão", "MATÉRIA COMPLETA NOS
  STORIES".

Marcador de variável que não existe é problema do padrão (a tela aponta a caixa).
Variável sem valor vira texto vazio, e caixa que fica vazia não desenha — nem a
pílula atrás dela.

**D3 — Cada caixa de texto tem um modo.** *(cliente, 14/09)*

| Modo | No editor | No post / na matéria |
|---|---|---|
| **Estático** | texto fixo; `{{` é literal | nada a preencher |
| **Dinâmico** | texto com variáveis | resolve sozinho; não aparece campo |
| **Editável** | texto com variáveis + rótulo do campo | aparece um campo já preenchido com o resolvido; o que a pessoa digita vale só para aquele post |

As variáveis DO PADRÃO usadas em qualquer caixa aparecem como campos no post
(com o valor padrão). As do sistema não — vêm da matéria; para trocá-las num
post, a caixa precisa ser Editável. Assim o designer decide o que a redação pode
mexer.

**D4 — Fontes: lista fixa.** *(cliente, 14/09)* Continua `TEMPLATE_FONTS` (09,
D6), com os arquivos do `@fontsource`. No servidor, `FontLibrary.use` com o
`.woff`; no navegador, as mesmas famílias pelo CSS do `@fontsource`, esperadas
com `document.fonts.load` antes de desenhar — senão a primeira medida sai com a
fonte de reserva.

**D5 — Padrões e artes antigos são descartados.** *(cliente, 14/09)* Eram de
teste. A migração apaga os padrões e limpa `art` dos posts em rascunho; posts já
aprovados ou publicados perdem só a cópia do desenho (a imagem publicada
continua no armazenamento).

**D6 — Modelo próprio, não o JSON do Konva.** O padrão é gravado num formato
nosso (`ArtDesign`), validado pelo agregado, e traduzido para nós Konva pela
`art-scene`. O JSON do Konva (`toJSON`) mistura estado de tela (seleção, escala)
com desenho, não valida nada e amarraria o banco a uma versão da biblioteca.

**D7 — Coordenadas em pixels do quadro final.** 1080 de largura; altura pelo
formato (1080, 1350, 1920). Zoom e tamanho da tela são só da tela. Posição é o
canto superior esquerdo ANTES da rotação, rotação em graus em torno do centro
da caixa — o mesmo que o usuário vê nos campos X/Y/L/A/°.

**D8 — Texto que não cabe encolhe, medido de verdade.** Tamanho cheio → mínimo,
com máximo de linhas; a medida é a do próprio `Konva.Text` (a mesma fonte, nos
dois lados), não mais a largura média estimada da 09 (D7 de lá). Nem no mínimo
coube: corta com reticências e o post avisa antes de aprovar.

**D9 — A prévia do post é desenhada no navegador.** Com a mesma `art-scene`, a
prévia do post e do cartão da matéria atualiza a cada tecla, sem ir ao servidor.
O PNG do servidor fica para publicar (e para quem quiser conferir o final).

**D10 — Desfazer por foto do desenho.** Cada mudança concluída (soltar o
arraste, sair do campo) guarda o desenho inteiro, até 100 passos. É o que o
nerp-2 faz; o desenho tem no máximo 60 elementos, e fotos inteiras não erram
como uma pilha de comandos inversos erra.

---

## 3. Escopo

| Fatia | Entrega | Estado |
|---|---|---|
| F1 | Domínio: `ArtDesign` (elementos, variáveis, modos de texto), validação, resolução das variáveis, campos do post; migração que descarta o antigo | ✅ 14/09 |
| F2 | `@portal-app/art-scene` (padrão → nós Konva, ajuste do texto) e desenhista do servidor com skia-canvas; API | ✅ 14/09 |
| F3 | Editor: palco com zoom e pan, seleção múltipla, transformar (mover/redimensionar/girar), guias magnéticas, desfazer, atalhos, copiar/colar, painel de camadas (ordem, travar, ocultar, renomear), alinhar e distribuir | ✅ 14/09 |
| F4 | Inspetor completo (texto, forma, imagem, foto, fundo), variáveis do padrão, inserir variável, modos de texto, dados de exemplo, "Conferir arte final" pelo servidor | ✅ 14/09 |
| F5 | Post e matéria: campos das variáveis e caixas editáveis, prévia Konva ao vivo | ✅ 14/09 |

### Não entra (e por quê)

- **Agrupar elementos.** A seleção múltipla cobre mover e alinhar juntos; grupo
  persistido entra quando uma arte real pedir.
- **Upload de fonte.** Decisão do cliente (D4).
- **Filtros de imagem e remover fundo.** Nenhuma arte do veículo usa.
- **Várias páginas / carrossel desenhado.** Um padrão é um quadro.

---

## 4. Modelo (F1)

```ts
type ArtDesign = {
  background: string;               // cor do quadro (#rrggbb)
  elements: ArtElement[];           // a ordem é a pilha: o primeiro fica embaixo
  variables: TemplateVariable[];    // as do padrão
};

type ElementBase = {
  id: string; name: string;
  x: number; y: number; width: number; height: number;
  rotation: number; opacity: number;   // 0..1
  visible: boolean; locked: boolean;
};

type ArtElement =
  | ElementBase & { kind: "PHOTO"; cornerRadius: number; stroke: Stroke | null }
  | ElementBase & { kind: "IMAGE"; mediaId: string; fit: "cover" | "contain" | "stretch"; cornerRadius: number }
  | ElementBase & { kind: "RECT"; fill: Fill; cornerRadius: number; stroke: Stroke | null; shadow: Shadow | null }
  | ElementBase & { kind: "ELLIPSE"; fill: Fill; stroke: Stroke | null; shadow: Shadow | null }
  | ElementBase & { kind: "LINE"; stroke: Stroke }
  | ElementBase & { kind: "TEXT"; mode: "STATIC" | "DYNAMIC" | "EDITABLE";
                    content: string; fieldLabel: string; style: TextStyle };

type Fill = { type: "solid"; color: string }
          | { type: "linear"; angle: number; stops: { offset: number; color: string }[] };

type TextStyle = {
  fontFamily; fontWeight; italic; fontSize; minFontSize; maxLines;
  lineHeight; letterSpacing; color; align; verticalAlign; uppercase;
  stroke: Stroke | null; shadow: Shadow | null;
  background: { color: string; radius: number; paddingX: number; paddingY: number;
                shape: "hug" | "box" } | null;   // hug = pílula do tamanho do texto
};

type TemplateVariable = { key: string; label: string; defaultValue: string; multiline: boolean };
```

No post, a escolha de arte (09, D18) passa a guardar `design` (cópia) +
`values` (variáveis do padrão, por chave) + `texts` (caixas Editáveis trocadas,
por id). O `artContent` do post ganha `subtitle`, `authorName`, `siteName` e
`date` para as variáveis do sistema.

## 5. Casos de teste (F1)

- `{{ titulo }}` com espaços resolve; `{{inexistente}}` é problema do padrão.
- Estático não resolve `{{`.
- Caixa Editável: campo mostra o resolvido; digitar igual ao resolvido não
  guarda troca; apagar tudo é troca legítima (texto vazio).
- Variável do padrão sem valor no post usa o padrão; com valor vazio, vazio.
- Chave de variável: minúsculas, dígitos e `_`; não pode repetir nem colidir
  com as do sistema.
- Elemento: caixa toda fora do quadro, cor inválida, opacidade fora de 0..1,
  degradê com menos de 2 paradas, mais de uma FOTO, fonte sem o peso.
- Descartar variável do padrão remove os valores guardados no post.

# Spec — Fase 9: Padrões de arte para as redes sociais

> **Status:** 🚧 Em execução — F1 (domínio), F2 (persistência e API) e F3
> (desenhista e prévia) entregues em 14/09/2026. F4 (editor visual) em andamento.
> **Decisões do cliente:** tomadas em 14/09/2026 (D1–D4 abaixo).
> **Referências:** `08-redes-sociais.md` (a fila, as entregas e os Stories — §17) ·
> `06-biblioteca-de-midia.md` (de onde vêm foto e moldura) ·
> `07-seo-e-indexacao.md` (a rota `/og`, que já desenha imagem com `next/og`).

---

## 1. Objetivo

**A notícia sai nas redes com a cara do veículo sem ninguém abrir um editor de
imagem.**

Hoje a arte de cada post é montada à mão: a foto, a moldura vermelha, o chapéu
"ÚLTIMAS", o título em amarelo, a chamada "matéria completa nos stories". É o
mesmo desenho toda vez, refeito toda vez — e, num dia de plantão, é o passo que
atrasa ou que sai torto.

Critério de sucesso em uma frase: **a redação escolhe um padrão, confere o
título e aprova — e a arte que vai ao ar é idêntica à que ela viu.**

---

## 2. O que o cliente mostrou

Duas imagens (14/09):

1. **A moldura** — um PNG 1080×1920 com o cartão vermelho de cantos
   arredondados, a pílula branca vazia (onde vai o chapéu) e o logo.
2. **A moldura em uso** — 1080×1350 (4:5): a foto da matéria ao fundo, o cartão
   por cima, "ÚLTIMAS" na pílula, o título em amarelo, caixa-alta, itálico e
   negrito, e a chamada "MATÉRIA COMPLETA NOS STORIES" num botão branco.

Ou seja: **camadas**. Foto embaixo, moldura por cima, textos por cima da moldura.
É esse o modelo.

---

## 3. Escopo

### Entra

| Fatia | Entrega | Estado |
|---|---|---|
| F1 | Domínio: `ArtTemplate` (camadas, formato, validação), ajuste do texto ao espaço, chave da arte gerada | ✅ 14/09 |
| F2 | Persistência, casos de uso e API dos padrões | ✅ 14/09 |
| F3 | Renderizador no servidor (Satori + resvg + fontes embarcadas → JPEG) e prévia | ✅ 14/09 |
| F4 | Editor visual de padrões (aba **Padrões** em Redes sociais) | — |
| F5 | Padrão aplicado ao post: por destino, textos editáveis, rascunho automático já com arte | — |
| F6 | Na matéria: criar a publicação (feed e/ou story, rascunho ou aprovada) a partir do editor da matéria | — |

### Não entra (e por quê)

- **Editor livre por post (tipo Canva).** Decisão do cliente (D1): a identidade
  visual mora no padrão. Por post, mexe-se no TEXTO e no enquadramento da foto,
  não no desenho.
- **Rotação, filtros e efeitos de camada.** Nenhum aparece nas artes do veículo.
  Entram quando uma arte real pedir.
- **Fonte enviada pelo usuário.** As fontes são uma lista fechada, embarcada no
  servidor (D6). Fonte subida pela tela é licença que ninguém conferiu e arquivo
  que o renderizador pode não ler.
- **Vídeo e Reels.** Mesma razão da spec 08.

---

## 4. Decisões

**D1 — Padrão com camadas, não editor livre.** *(cliente, 14/09)* O padrão é
montado uma vez — moldura, posição da foto, caixas de texto com fonte, cor e
tamanho. Ao postar, a redação escolhe o padrão, ajusta o texto e o enquadramento.
Quem garante a identidade é o padrão, não a disciplina de cada pessoa.

**D2 — O post automático já chega com arte.** *(cliente, 14/09)* Matéria
publicada → rascunho na fila com a arte do padrão-padrão de cada destino já
desenhada. Consequência técnica: **quem desenha é o servidor**, não o navegador
de quem edita (D5).

**D3 — O formato é do padrão.** *(cliente, 14/09)* Cada padrão declara 1:1, 4:5
ou 9:16. Padrão 9:16 serve aos Stories; 1:1 e 4:5, ao feed. O corte 1:1 de hoje
continua sendo o comportamento de quem não escolhe padrão.

**D4 — Os Stories foram commitados antes** *(cliente, 14/09)*: os padrões nascem
sobre `f5aa923`.

**D5 — Um desenhista só: o servidor, com Satori + resvg.** A prévia do editor é
um PNG pedido ao servidor, desenhado pelo MESMO código que gera a arte
publicada. A alternativa — desenhar no navegador e subir o resultado — daria
duas implementações de layout (canvas no cliente, algo no servidor para o
automático) que divergem na primeira fonte ou quebra de linha diferente, e a
promessa "o que você viu é o que foi ao ar" deixaria de valer.

*Por que não o `next/og`, que já desenha `/og`:* ele rasteriza com o `sharp`
**do Next** (0.34) sempre que consegue importá-lo, e só cai no resvg se não
conseguir. O portal carrega também o `sharp` do projeto (0.35, o do corte da
capa), e com as duas versões nativas no mesmo processo a rasterização quebra
(`colourspace: parameter space not set`) — provado num teste isolado em 14/09:
o mesmo desenho passa sem o `sharp` do projeto carregado e falha com ele. Por
isso o renderizador usa `satori` e `@resvg/resvg-js` diretamente, com as fontes
do `@fontsource` como arquivo: o resultado não depende de qual `sharp` foi
carregado antes.

No editor, arrastar e redimensionar acontece em caixas HTML sobre a prévia (é
interação, não arte); ao soltar, a prévia real é pedida de novo.

**D6 — Fontes: lista fechada, embarcada.** O Satori não lê fonte do sistema: cada
família precisa ir como arquivo. A lista é curta e declarada no domínio
(`TEMPLATE_FONTS`), com os pesos e o itálico que cada uma tem — o editor só
oferece o que o renderizador sabe desenhar.

**D7 — O texto encolhe para caber, até um mínimo.** Cada caixa de texto tem
tamanho, tamanho mínimo e máximo de linhas. O título de três palavras sai
grande; o de vinte encolhe até caber — e, se nem no mínimo couber, é cortado com
reticências **e a tela avisa antes da aprovação**. A escolha do tamanho é uma
função pura (`fitText`), baseada em largura média de caractere por família; a
quebra de linha final é do Satori.

**D8 — A arte gerada é cache, não mídia.** A imagem desenhada vai ao
armazenamento numa chave que é o hash de tudo que a define (padrão, versão do
padrão, foto, ponto focal, textos). Mesma ideia do corte da capa na spec 08:
reenviar não redesenha, e mudar qualquer entrada gera outra chave em vez de
servir a arte velha. Ela **não** entra na biblioteca de mídia — não tem crédito
nem alt próprios; o alt publicado é o da foto.

**D9 — Padrão editado não muda post aprovado.** O post guarda a VERSÃO do padrão
que foi aprovada. Editar o padrão depois vale para os próximos posts; o que já
está no ar (ou na fila de envio) mantém o desenho que alguém viu e aprovou — é o
D8 da spec 08 aplicado à arte.

**D10 — Um padrão-padrão por destino.** Um padrão pode ser o padrão do feed do
Instagram, dos Stories, do Facebook. A regra "um só por destino" é da aplicação
(marcar um desmarca o anterior), e o formato precisa servir ao destino — padrão
4:5 não pode ser o padrão dos Stories.

**D11 — Escolher é editorial; desenhar é gestão.** *(F2)* Ver e escolher padrão
pede `social:publish` (o editor tem — senão a fila para). Criar, editar,
duplicar, arquivar e marcar padrão de destino pede `social:manage`, a mesma
permissão de conectar conta: o padrão decide como TODO post do veículo vai
parecer. Trocar é uma linha em `manage-templates.ts`.

**D12 — Camadas em JSON, mídias em coluna.** *(F2)* A pilha de camadas é gravada
inteira numa coluna `Json` — sempre lida e escrita inteira, validada pelo
agregado. As mídias que o desenho usa são copiadas para `mediaIds String[]`,
para a biblioteca responder "esta imagem está em uso?" com um `has`: apagar a
moldura de um padrão (arquivado inclusive) é recusado como apagar a capa de
uma matéria.

**D13 — Arquivar, nunca apagar.** *(F2)* Post aprovado aponta para a versão do
padrão (D9); apagar o padrão tiraria o desenho de quem ainda vai ser reenviado.
Arquivado sai da escolha e deixa de ser padrão de destino. Para usá-lo de novo,
duplica-se.

**D14 — As fontes são achadas no disco, não resolvidas como módulo.** *(F3)* O
Turbopack analisa no build toda resolução de módulo — inclusive o `.resolve` de
um `createRequire`, e mesmo com `turbopackIgnore` — e, com caminho dinâmico,
tenta casá-lo com o `exports` do `@fontsource`. Não consegue, e a rota do tRPC
inteira caía com "module not found" (visto no servidor de desenvolvimento em
14/09). A saída foi não usar `require`: `findInNodeModules` sobe as pastas a
partir do arquivo em execução e do `cwd` procurando o `.woff`. Três
consequências, todas no código:

- as fontes são dependência de `packages/api` (testes) **e** de `apps/web`
  (servidor) — com o pnpm, cada pacote só enxerga o próprio `node_modules`;
- `outputFileTracingIncludes` no `next.config` leva os `.woff` para o deploy, que
  o rastreador de arquivos também não enxerga;
- `serverExternalPackages` carrega `satori` (WASM de layout) e `@resvg/resvg-js`
  (binário nativo) do `node_modules`, e não do bundle.

**D15 — A prévia é uma mutation que devolve a imagem.** *(F3)*
`social.templates.preview` recebe o padrão AINDA NÃO SALVO, desenha com o mesmo
`ArtRenderer` da arte publicada e devolve um PNG de 540 px em data URL, junto
com os problemas do padrão e os avisos de texto cortado. Mutation só pelo
tamanho do corpo: as camadas não cabem numa URL.

---

## 5. Modelo de domínio (F1)

`packages/contexts/social/src/domain/template/`

```
ArtTemplate (agregado)
├── id, name, format (1:1 | 4:5 | 9:16), version, archived
├── defaultFor: SocialDestination[]   (compatíveis com o formato — D10)
└── layers: TemplateLayer[]           (a ORDEM é a pilha: o primeiro fica embaixo)
    ├── PHOTO   box                                  — a foto do post (no máximo uma)
    ├── IMAGE   box, mediaId, fit                    — moldura, logo, selo
    ├── SHAPE   box, color, radius, opacity          — faixa, fundo de texto
    └── TEXT    box, source (HEADLINE | KICKER | SECTION | STATIC), text, style
                style: família, peso, itálico, tamanho, mínimo, entrelinha,
                       cor, caixa-alta, alinhamento, vertical, máx. de linhas,
                       fundo (cor, raio, respiro) opcional
```

Funções puras ao lado do agregado:

| Função | Papel |
|---|---|
| `textForLayer(layer, content, overrides)` | o texto que vai na caixa: o que a redação digitou para ESTE post, senão o dado da matéria, senão o texto fixo |
| `fitText(text, layer)` | tamanho de fonte que cabe, linhas estimadas e se coube (D7) |
| `artImageKey(input)` | a chave da arte no armazenamento (D8) |

Todas as medidas em **pixels do quadro final** (1080 de largura). Sem unidade
relativa: o editor mostra em escala, o renderizador desenha em tamanho real.

---

## 6. Telas (F4–F6) — esboço

- **Redes sociais → Padrões:** lista de padrões com miniatura, formato e de que
  destino é padrão. "Novo padrão" pede nome e formato.
- **Editor do padrão:** quadro no centro (prévia real + caixas arrastáveis),
  camadas à esquerda (ordem por arrastar, adicionar foto/imagem/forma/texto),
  propriedades à direita. Dados de exemplo editáveis para testar título curto e
  longo.
- **Editor do post:** por destino, escolher o padrão (ou "sem padrão"), ajustar
  os textos e o enquadramento; a prévia é a arte real.
- **Editor da matéria:** cartão "Redes sociais" — criar a publicação com feed
  e/ou story, padrão de cada um, e salvar como rascunho ou aprovar.

---

## 7. Casos de teste (F1)

- Padrão válido nasce com versão 1; editar incrementa a versão.
- Recusa: nome vazio, duas camadas de foto, ids repetidos, caixa fora do quadro,
  cor inválida, família fora da lista, peso ou itálico que a família não tem,
  tamanho mínimo acima do tamanho, texto fixo vazio.
- `defaultFor` recusa destino incompatível com o formato (4:5 nos Stories).
- `textForLayer`: override vence o dado da matéria; caixa-alta em pt-BR (ç, ã).
- `fitText`: título curto fica no tamanho cheio; longo encolhe; impossível
  devolve o mínimo com `fits: false`; respiro do fundo reduz a largura útil.
- `artImageKey`: mesma entrada → mesma chave; qualquer campo diferente → outra.

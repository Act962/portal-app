# Arte-mestre da marca — Portal 7 Cidades

Os arquivos originais entregues pelo cliente em 13/08/2026, na resolução em que
vieram. **Nada aqui é servido ao leitor**: este diretório está fora de
`apps/web/public/`, de propósito, então não entra no bundle nem responde a uma
URL. O que o portal serve são as versões reduzidas em
[`apps/web/public/brand/`](../../apps/web/public/brand/).

Existe por um motivo prático: sem ele, a arte-mestre viveria só na pasta de
downloads de uma máquina. No dia em que alguém precisar de outro tamanho, de um
recorte diferente ou de refazer o favicon, a origem tem que estar no repositório
— um PNG de 512px não volta a ser um de 3508px.

## O que é cada arquivo

Todos com canal alfa (fundo transparente), o que é o que permite aplicar o
filtro de branco no cabeçalho sem serrilhar as bordas.

| Arquivo | Dimensões | O que é |
|---|---|---|
| `logo_7_cidades.png` | 3508×3508 | Lockup **empilhado**: símbolo em cima, "Portal Cidades" embaixo |
| `icon_7_cidades.png` | 3508×3508 | Só o símbolo do "7", em dois marrons |
| `icon_7_cidades_mono_cor.png` | 3508×3508 | O símbolo em um marrom só |
| `icon_7_cidades_pb.png` | 3508×3508 | O símbolo em preto |
| `FAVICON_portal_7_cidades.png` | 3508×3508 | Símbolo desenhado para ir **sobre fundo colorido** — o miolo é branco, não transparente |
| `barra_rupestre.png` | 3371×249 | Faixa marrom com os grafismos rupestres alinhados à direita |
| `transparence_rupestre.png` | 3132×648 | Os mesmos grafismos, sem o fundo |

**Não veio na pasta:** o lockup **horizontal**, e nenhuma versão em branco. É por
isso que o cabeçalho compõe a assinatura em Montserrat ao lado do símbolo, em vez
de usar um arquivo — ver `apps/web/src/components/layout/site-logo.tsx` e o item 8
de [`docs/pendencias.md`](../../docs/pendencias.md).

## De onde veio cada arquivo servido

| Servido em `public/brand/` | Origem | Tratamento |
|---|---|---|
| `logo-7-cidades.png` | `logo_7_cidades.png` | 1024px, transparente |
| `symbol.png` | `icon_7_cidades.png` | 512px, **transparente** |
| `favicon.ico` | `FAVICON_portal_7_cidades.png` | 16·32·48·256, **chapado no marrom** |
| `icon-512.png` · `icon-192.png` · `apple-icon.png` | `FAVICON_portal_7_cidades.png` | idem, chapado |
| `rupestre.png` | `transparence_rupestre.png` | 900px, transparente |

**Por que o símbolo e o ícone são arquivos diferentes.** O cabeçalho pinta o
símbolo de branco com `brightness-0 invert`, o que exige fundo transparente —
uma arte chapada viraria um quadrado branco. Já ícone de tela inicial **não
pode** ser transparente: Android e iOS compõem sobre branco ou preto por conta
própria, e o "7" vazado sumiria num dos dois. São exigências opostas, então são
dois arquivos.

Dois originais seguem sem uso: `icon_7_cidades_mono_cor.png` e
`icon_7_cidades_pb.png`. O `barra_rupestre.png` também não é servido, mas foi
ele que sugeriu o uso do grafismo como textura dos blocos marrons.

## Como regerar

O `sharp` já vem com o Next, então não é preciso instalar nada. O script está
em [`gerar-assets.mjs`](./gerar-assets.mjs), ao lado — da raiz do repositório:

```bash
node design/marca/gerar-assets.mjs
```

Ele reescreve os sete arquivos de `apps/web/public/brand/` e imprime o tamanho
de cada um. É idempotente: rodar duas vezes produz os mesmos bytes.

Duas coisas que o script resolve e que não são óbvias:

- **`palette: true`** é o que segura o peso nas artes transparentes — o lockup
  sai de 326 KB para 45 KB sem diferença visível, porque são poucas cores
  chapadas.
- **O `.ico` é montado à mão**, porque o `sharp` não escreve esse formato. O
  contêiner aceita cada imagem como BMP cru ou como PNG inteiro; o script usa
  PNG, que todo navegador lê desde o IE11 e dispensa escrever o cabeçalho DIB e
  a máscara AND — que é justamente onde esse tipo de gerador erra.

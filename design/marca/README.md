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

| Servido em `public/brand/` | Origem | Redução |
|---|---|---|
| `logo-7-cidades.png` | `logo_7_cidades.png` | 1024px |
| `icon-512.png` · `icon-192.png` · `apple-icon.png` | `icon_7_cidades.png` | 512 · 192 · 180px |
| `rupestre.png` | `transparence_rupestre.png` | 900px |

`favicon.ico` é anterior a esta entrega e segue sendo o fallback legado — ele
**ainda não foi refeito com a marca nova** (pendência 8).

Três originais não geraram nada até agora: `icon_7_cidades_mono_cor.png`,
`icon_7_cidades_pb.png` e `barra_rupestre.png`.

## Como regerar

O `sharp` já vem com o Next, então não é preciso instalar nada. Da raiz do
repositório:

```bash
node -e 'const s=require("./node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js");const j=[["logo_7_cidades","logo-7-cidades",1024],["icon_7_cidades","icon-512",512],["icon_7_cidades","icon-192",192],["icon_7_cidades","apple-icon",180],["transparence_rupestre","rupestre",900]];(async()=>{for(const [from,to,w] of j){await s(`design/marca/${from}.png`).resize({width:w,withoutEnlargement:true}).png({compressionLevel:9,palette:true}).toFile(`apps/web/public/brand/${to}.png`);console.log(to,w)}})()'
```

`palette: true` é o que segura o peso — o lockup sai de 326 KB para 46 KB sem
diferença visível, porque são poucas cores chapadas. Confira o caminho do
`sharp` se a versão tiver mudado (`ls node_modules/.pnpm | grep sharp`).

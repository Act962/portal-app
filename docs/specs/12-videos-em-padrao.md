# Spec — Fase 12: vídeo dentro do padrão (Reels e Stories)

> **Status:** 🚧 Implementada em 21/09/2026, **não validada em produção** — nenhum
> Reels saiu de verdade ainda. Falta subir um vídeo real, montar e publicar.
> **Motivo:** o cliente quer o mesmo fluxo das artes de imagem, mas para vídeo:
> pegar um vídeo, vesti-lo com o padrão do veículo e mandar para o Instagram.
> **Estende:** `09-padroes-de-arte.md` (o padrão), `10-editor-de-artes-konva.md`
> (a cena) e `08-redes-sociais.md` (a fila e a entrega).

---

## 1. Objetivo

**O mesmo padrão que veste a foto veste o vídeo, e o resultado vai para o Reels
e para os Stories sem ninguém abrir outro programa.**

Critério de sucesso: **quem cuida das redes sobe o vídeo da entrevista, escolhe
o padrão, arrasta as duas alças para pegar o trecho bom, confere a prévia — que
já toca com a faixa vermelha e o título por cima — e aprova. Minutos depois o
Reels está no ar.**

O que esta fase **não** faz: trilha sonora, legenda automática, transição entre
cortes, várias faixas sobrepostas. Vários trechos em sequência, sim — é a linha
do tempo do D10.

---

## 2. Decisões

**D1 — O vídeo ocupa o lugar da FOTO. Não existe elemento novo.** Quem desenha
um padrão desenha um só: a mesma caixa recebe a foto do dia ou o vídeo da
entrevista, e a redação decide depois. Um padrão 9:16 feito para os Stories
serve ao Reels sem ninguém redesenhar nada.

A consequência é a divisão em três camadas, e é ela que o resto da spec segue:

```
  o que está ACIMA do lugar da foto  →  PNG com transparência
  o vídeo                            →  recortado e posto na caixa
  o que está ABAIXO + o fundo        →  PNG opaco
```

Padrão SEM lugar de foto (só a moldura e o logo) continua servindo: aí o vídeo
ocupa o quadro inteiro e todo o desenho fica por cima.

**D2 — O Reels é destino próprio, não "o feed com um vídeo".** `INSTAGRAM_REELS`
entra em `SOCIAL_DESTINATIONS` com formato `REEL`. A chamada da Meta é outra
(`media_type=REELS`), o quadro é 9:16 e não 1:1, e o conteúdo é sempre vídeo —
tratá-lo como variação do feed obrigaria todo `if (format === "FEED")` do
sistema a perguntar depois "mas é vídeo?".

`share_to_feed=true` faz o Reels aparecer TAMBÉM na grade do perfil. Sem ele o
vídeo sai só na aba de Reels, e a matéria some do lugar onde o leitor do portal
costuma procurá-la.

| Destino | Formato | Mídia | Duração |
|---|---|---|---|
| `INSTAGRAM` | 1:1 ou 4:5 | só imagem | — |
| `INSTAGRAM_REELS` | 9:16 | só vídeo | 3 s a 15 min |
| `INSTAGRAM_STORIES` | 9:16 | imagem **ou** vídeo | 3 s a 60 s |
| `FACEBOOK` | 1:1 ou 4:5 | só imagem | — |

**D3 — Quem monta é o ffmpeg; quem desenha continua sendo o Konva.** As duas
camadas saem da MESMA cena (`@portal-app/art-scene`) que o editor e o
`ArtRenderer` usam — é o que mantém a prévia e o arquivo publicado iguais. O
ffmpeg só empilha:

```
[0] under.png (em laço)
[1] o vídeo, recortado no ponto focal e escalado para a caixa
[2] over.png (em laço)
[3] mask.png — só quando o canto é arredondado
```

O recorte focal vai como EXPRESSÃO do ffmpeg (`max(0,min(in_w-out_w,…))`), e não
como um retângulo em pixels: medir o arquivo exigiria abri-lo no servidor para
fazer uma conta que o próprio ffmpeg faz com `in_w`/`in_h`.

O vídeo de origem entra pela URL pública, sem passar pelo disco — a função que
roda isto tem `/tmp` pequeno, e um arquivo de celular de noventa segundos come
metade dele antes de a montagem começar.

**D4 — A prévia não vai ao servidor.** O editor empilha três camadas de CSS: o
`ArtCanvas` do desenho de baixo, um `<video>` de verdade recortado na caixa
(`object-fit: cover` com `object-position` é o equivalente exato do
`scale`+`crop` do ffmpeg), e o `ArtCanvas` de cima. Quem arrasta o corte vê o
resultado no mesmo segundo, sem transcodificar nada.

É o que torna a feature fácil de usar, e a razão de não existir botão
"gerar prévia".

**D5 — O vídeo montado é CACHE, com chave de hash.** Mesma ideia do
`artImageKey`, e aqui ela vale muito mais: remontar custa dezenas de segundos de
processador, e reenviar um post que falhou no Instagram não pode pagar isso de
novo. O CORTE entra na chave junto com o desenho — sem ele, aparar meio segundo
e reenviar devolveria o arquivo antigo, e ninguém repara num vídeo quase igual.

O `.mp4` e a capa `.jpg` saem da MESMA chave, para as duas andarem juntas.

**D6 — Teto de 90 segundos, e ele é do PORTAL, não do Instagram.** O Reels
aceita quinze minutos; o nosso renderizador roda numa função com tempo máximo de
execução, e um vídeo de dez minutos estoura esse tempo — a entrega ficaria
repetindo para sempre sem nunca terminar. As mensagens de erro distinguem os
dois limites, porque quem lê precisa saber a quem pedir mais.

Subir esse número exige mover a montagem para fora da função (uma fila com
máquina própria), não só trocar a constante.

**D7 — A duração é medida no NAVEGADOR, antes do envio.** Medir no servidor
significaria baixar o arquivo de volta do armazenamento só para ler um
cabeçalho. O post guarda uma CÓPIA dela (`sourceSeconds`), como já guarda o
`artContent`: assim ele responde sozinho se o trecho cabe no limite da rede, sem
ir buscar o arquivo.

**D8 — O arquivo e o corte andam juntos, nos dois sentidos.** Trocar o arquivo
invalida o corte (`clipFor`): as marcas apontavam para os segundos de OUTRO
vídeo, e aproveitá-las publicaria um trecho que ninguém escolheu. E **escolher o
vídeo anexa o arquivo ao post**, trocando o que estivesse lá — um post é de
vídeo OU de imagens, nunca dos dois (o Reels publica um vídeo só; os destinos de
imagem recusam vídeo).

As duas metades moram no agregado, não na tela. A segunda faltou na primeira
versão, e o sintoma era o pior possível: escolher um vídeo não dava erro nenhum,
o seletor fechava e a escolha simplesmente sumia.

**D10 — Vários trechos, em sequência.** O post guarda uma LISTA de trechos, não
um só: a montagem de portal quase nunca é um corte único — é a declaração do
prefeito, o corte para a rua alagada, a volta. O mesmo arquivo pode aparecer
duas vezes, e isso é o caso normal, não a exceção.

A régua mede a SOMA, não cada trecho: o Instagram recebe um arquivo só, e é a
duração dele que as redes limitam. Por isso o mínimo publicável (3 s) vale para
o vídeo inteiro, enquanto a alça de corte trabalha com meio segundo — um pedaço
de um segundo é edição legítima; o que precisa ter três segundos é o resultado.

No ffmpeg isso vira um `concat` com vídeo e áudio no MESMO filtro (separá-los
deixa a voz andando na frente da imagem a cada corte). Duas armadilhas custaram
caro e estão travadas por teste:

- **Trecho mudo no meio.** `concat` com `a=1` exige que todo segmento tenha
  áudio. Cada trecho mudo — por escolha, ou porque o arquivo não tem trilha —
  ganha uma fonte de silêncio PRÓPRIA e finita. Uma fonte infinita repartida com
  `asplit` foi a primeira tentativa e matava o ffmpeg com "Cannot allocate
  memory": os ramos param de consumir quando o trecho acaba e o resto fica na
  memória.
- **As imagens do padrão também são infinitas.** `-loop 1` sem `-t` tem o mesmo
  fim: com o `concat` no meio do grafo, os quadros da emenda só aparecem depois
  de todos os trechos lidos, e nesse meio-tempo o ffmpeg empilha quadros das
  imagens até cair. As três fontes levam `-t` com a duração do vídeo.

Saber se um arquivo TEM trilha de áudio é pergunta para o próprio ffmpeg: uma
invocação sem saída lista as faixas no `stderr`. Um `ffprobe` seria outro
binário de oitenta megabytes para responder sim ou não.

**D11 — O editor é uma TELA, não um diálogo.** O corte dentro do diálogo do post
não dava conta: com vários trechos, a linha do tempo, a prévia e o painel do
padrão não cabem em 600 px sem tudo virar uma tira de rolagem. O editor em tela
cheia (`/dashboard/social/videos/[id]`) tem o mesmo arranjo do editor de
padrões, que a redação já conhece. No diálogo fica só o resumo — quantos
trechos, quanto tempo no ar — e o botão que leva ao editor.

**A emenda da prévia é simulada, não montada.** O mesmo `<video>` troca de
arquivo e de posição na hora certa (`positionAt`): quem assiste vê a montagem
inteira, e nada foi transcodificado para isso.

**D12 — Sem padrão que sirva, a tela diz e oferece a saída.** Com nenhum padrão
9:16 cadastrado, a escolha do Reels sobrava com "Sem padrão" e mais nada. A tela
não estava errada — o armário é que estava vazio —, mas também não dizia isso
nem mostrava o caminho, e quem abriu não tinha como saber que precisava criar um
padrão em outra tela, no formato certo, e voltar. Agora a falta é explicada e o
botão cria o padrão já no formato do destino. Criar padrão continua sendo de
quem tem `social:manage`; a quem só publica, o botão não aparece.

**D9 — Vídeo sem padrão continua publicável.** Sai enquadrado no formato do
destino, sobre o fundo do quadro — que é o que "publicar esse vídeo sem arte"
quer dizer. Exigir um padrão antes tornaria o caso mais simples o mais
trabalhoso.

---

## 3. Fluxos

**F1 — Montar o post de vídeo.** Na fila de redes sociais, abre o rascunho e
clica em "Montar vídeo" — vai para o editor em tela cheia. Lá, "Acrescentar
trecho" escolhe da biblioteca ou envia do computador (MP4, MOV ou WebM, com
crédito — texto alternativo não, que é invariante só de imagem). Cada trecho
nasce no arquivo inteiro, já aparado no teto.

**F2 — Cortar e ordenar.** A linha do tempo mostra os trechos lado a lado, na
largura do tempo que ocupam. O selecionado abre a barra de corte: duas alças, a
arrastada manda e a outra cede; o que não cede é o mínimo. Setas movem um
segundo, Shift + setas um décimo — numa barra de 300 px para 90 s cada pixel
vale um terço de segundo, e sem o passo fino o quadro exato é inalcançável. A
ordem se muda por botões, não arrastando: arrastar numa faixa de 40 px brigaria
com o arraste das alças logo abaixo, e o conflito é o tipo de coisa que faz
alguém cortar o trecho errado sem perceber.

**F3 — Escolher o padrão por destino.** No painel do editor, uma aba por destino
de vídeo, com a prévia em movimento à esquerda.

**F5 — Do editor da MATÉRIA.** O cartão "Redes sociais" tem "Montar vídeo desta
matéria": sem post ainda, cria o post da matéria já mirando o Reels — legenda,
título e editoria vêm da matéria, como no post de foto — e abre o editor. Com
post já criado, só ABRE o editor daquele post.

Não acrescenta o Reels aos destinos de um post existente, e a razão é a trava de
UM post por matéria (`autoKey`): um post de foto que ganhasse o Reels ficaria com
um destino que recusa vídeo e outro que o exige. Quem quiser trocar os destinos
faz isso na fila, vendo o que muda. **Quando a trava cair** — vários posts por
matéria —, este atalho passa a criar um post novo, e some a exceção.

A capa da matéria NÃO invade um post de vídeo: forçá-la como primeira mídia
trocaria o arquivo e descartaria a montagem inteira, com o sumiço aparecendo
depois de um salvamento na tela da matéria, longe de quem cortou o vídeo.

**F4 — Aprovar e publicar.** Idêntico ao post de imagem. O worker monta o vídeo
(ou reaproveita o do cache), cria o container na Meta e espera — com espera
própria de vídeo: 30 × 5 s, contra 12 × 5 s da foto. Usar a espera da foto faria
toda entrega de vídeo morrer no tempo limite e voltar para a fila, criando um
container novo a cada rodada e nunca publicando.

---

## 4. O que ficou de fora, e por quê

- **Vídeo na Página do Facebook.** Outra chamada da API; barato de acrescentar
  quando o veículo tiver Página conectada.
- **Carrossel de vídeo.** Não existe na API de publicação da Meta.
- **Vários posts por matéria.** É a trava do `autoKey`, e derrubá-la é trabalho
  próprio (migration, a fila passando a agrupar por matéria). Ver F5.
- **Repetição do lugar da foto** (`repeat`, spec 10). Vale para foto; num vídeo
  o custo de decodificar N vezes não paga o efeito.

---

## 5. Operação

`maxDuration = 300` nas rotas que rodam as tarefas (`/api/inngest` e
`/api/cron/[task]`). **Isto exige Fluid Compute ligado no projeto da Vercel**
(padrão nos projetos novos) ou um plano que permita o valor; sem isso o deploy
falha dizendo qual é o máximo.

O binário do ffmpeg vem do `ffmpeg-static`, que o baixa no `postinstall` — por
isso ele está em `onlyBuiltDependencies` no `pnpm-workspace.yaml`, junto do
`sharp` e do `skia-canvas`, e em `outputFileTracingIncludes` no
`next.config.ts`. Sem as duas coisas o pacote instala vazio e a montagem quebra
na primeira chamada, em produção.

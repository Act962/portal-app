# Spec — Fase 8: Redes Sociais (Instagram e Facebook)

> **Status:** 🚧 Em execução — Fatias 1 e 2 entregues em 11/09/2026 (domínio,
> persistência, gatilho, casos de uso e API); Fatia 3 (telas do painel) e Fatia 4 (adapter real da Meta, login e corte da capa) em 14/09/2026. Fatia 5, parte do código (diagnóstico, cota, reenvio automático e callbacks exigidos pela Meta), em 14/09/2026. **Falta a parte fora do código**: criar o App, testar contra a Meta real e passar pelo App Review — roteiro em §14.3.
> **Decisões do cliente:** tomadas em 11/09/2026 (D1–D4 abaixo).
> **Referências:** `01-identidade-acesso.md` (as ações novas) ·
> `../adr/0005-outbox-transacional.md` (o gatilho) ·
> `../adr/0009-midia-atras-de-porta-r2-minio.md` (a arte do post) ·
> `06-biblioteca-de-midia.md` (de onde sai a imagem) ·
> [Instagram Platform · Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing) ·
> [Facebook Pages API](https://developers.facebook.com/docs/pages-api/).

---

## 1. Objetivo

**A redação publica no portal uma vez e o Instagram e o Facebook saem juntos,
sem ninguém redigitar nada.**

Hoje a mesma notícia é escrita duas vezes: uma no painel, outra no celular de
quem cuida das redes. É trabalho duplicado que, em dia de plantão, vira
notícia publicada no site e ausente no Instagram — ou pior, publicada no
Instagram com um título diferente do que está no ar.

Critério de sucesso em uma frase: **publicada a matéria, o post já está montado
com legenda e imagem esperando um clique de aprovação — e esse clique põe a
notícia nas duas redes.**

---

## 2. Estado atual

| | Situação |
|---|---|
| Publicação nas redes | 100% manual, fora do sistema, pelo celular |
| App na Meta | **Não existe** — nada foi criado ainda (D4) |
| Conta do Instagram | Precisa ser verificada: só conta **Professional** vinculada a uma Página publica por API |
| Evento de publicação | `ArticlePublished` **já existe** e já passa pelo outbox (Fase 3) — o gatilho está pronto |
| Biblioteca de mídia | Capa com ponto focal, atrás da porta `MediaStorage` (Fase 2) — a arte do post sai daqui |
| Permissões | `social:publish` e `social:manage` criadas nesta fase |

O ponto que barateia tudo: **nada precisa ser construído no editorial.** O
módulo escuta um evento que já é emitido, pelo mesmo outbox que a auditoria já
usa. O editorial não fica sabendo que redes sociais existem.

---

## 3. Escopo

### Entra

| Fatia | Entrega | Estado |
|---|---|---|
| F1 | Domínio puro: `SocialPost`, `Delivery`, `SocialAccount`, `Caption`, modelo de legenda, portas | ✅ 11/09 |
| F2 | Persistência (Prisma), casos de uso, gatilho no `ArticlePublished`, tRPC | ✅ 11/09 |
| F3 | Telas do painel: fila de aprovação, editor do post, conexão de contas | ✅ 14/09 |
| F4 | Adapter real da Meta + OAuth + corte 1080×1080 da capa | ✅ 14/09 |
| F5 | Preparação do go-live: diagnóstico, cota, reenvio, callbacks da Meta (código) · App, teste real e App Review (fora do código) | 🟡 código 14/09 |

### Não entra (e por quê)

- **Reels.** Exigem upload assíncrono de vídeo com polling de transcodificação —
  vale uma fatia própria. *(Os Stories com imagem entraram em 14/09 — ver §17.)*
- **Responder comentário e DM pelo painel.** É atendimento, não distribuição —
  outro contexto, outro conjunto de permissões.
- **Métricas de alcance e engajamento.** A Insights API é outra superfície. O
  módulo nasce escrevendo; ler vem depois.
- **Agendar post para horário futuro.** A fila de aprovação já resolve o
  problema real ("não quero que saia sem eu ver"). Agendamento é conforto, e
  entra quando alguém pedir — o `Scheduler` já existe para isso.
- **Outras redes (X, TikTok, WhatsApp Channels).** O desenho não impede: a
  porta `SocialPublisher` não menciona a Meta. Mas nenhuma linha será escrita
  antes de existir a demanda.

---

## 4. Decisões

**D1 — Fila de aprovação, não publicação automática.** *(cliente, 11/09)*
A matéria publicada gera um post em `RASCUNHO` com legenda e imagem montadas;
alguém revisa e aprova. O automático puro foi recusado porque o erro tem custo
assimétrico: título errado no portal se corrige em 10 segundos e quase ninguém
viu; no Instagram, apagar é perder o engajamento e assumir o erro em público.
A fila também é a tela principal do módulo — é onde o trabalho acontece.

**D2 — Feed com imagem e carrossel no MVP.** *(cliente, 11/09)*
Uma foto cobre o dia a dia; o carrossel cobre o "resumo do dia" e a galeria de
evento, que é o formato que mais rende em portal local. Custam APIs diferentes
(carrossel são N+2 chamadas: um container por imagem, um container do
carrossel, e a publicação), mas o mesmo agregado — `mediaIds` com uma ou várias
entradas.

**D3 — A arte sai da capa da matéria, e a redação pode trocar.** *(cliente, 11/09)*
O padrão é a capa cortada em 1080×1080 respeitando o ponto focal que a Fase 2 já
guarda. Quem aprova pode substituir por qualquer imagem da biblioteca antes de
publicar. Zero trabalho extra no caso comum, controle total no caso que precisa.

**D4 — O App na Meta será criado do zero.** *(cliente, 11/09)* Ver §6, que é o
passo a passo. Consequência de calendário: **App Review da Meta leva de dias a
semanas**, e nada vai ao ar antes dela. Por isso as fatias F1–F3 são construídas
contra um publisher falso e não dependem da aprovação.

**D5 — Uma conta por rede, não uma lista.** O portal é um veículo: um Instagram,
uma Página. Suportar várias custaria uma escolha de destino em toda tela para
resolver um problema que este cliente não tem. Voltar atrás depois é mais barato
do que remover uma escolha que a redação já aprendeu a fazer.

**D6 — Uma legenda, N entregas.** A redação escreve e aprova **uma vez**; cada
rede tem sua própria entrega, com seu próprio `remoteId` e seu próprio erro. É o
que permite o estado `PARCIAL` — o Facebook aceitou, o Instagram recusou a
imagem — e o que faz o "tentar de novo" reenviar **só** o que falhou. Sem isso,
reenviar um post parcial duplicaria o que já deu certo.

**D7 — `PUBLICANDO` é cadeado, não enfeite.** Publicar é chamada de rede, e
chamada de rede demora. Sem um estado que marque "já está a caminho", dois
cliques no botão viram dois posts — e o Instagram não tem desfazer. O segundo
`approve()` é recusado com erro, e a tela mostra o motivo.

**D8 — Depois de aprovado, o texto congela.** Não se volta a `RASCUNHO`. Editar
a legenda de um post que já está no Facebook criaria duas verdades sobre o que o
veículo disse, e a auditoria deixaria de servir para alguma coisa.

**D9 — O token não mora no agregado.** `SocialAccount` guarda *quando* o token
vence e se a conta está ligada; o segredo fica atrás do repositório, cifrado, e
só o adapter que fala com a Meta o enxerga. O agregado vira DTO do tRPC, vira
linha de auditoria e vira log de erro — três caminhos por onde um campo
`accessToken` vazaria sem ninguém escrever uma linha errada.

**D10 — UM modelo de legenda, com o link acrescentado só onde ele funciona.**
*(revisto na F2)*

A versão anterior desta decisão previa um modelo por rede, e ela **contradizia o
D6**: dois modelos produzem duas legendas, e duas legendas significam aprovar
duas vezes — no dia em que alguém corrigisse só uma, o veículo estaria dizendo
coisas diferentes em cada rede sem ninguém perceber.

O que vale: **uma** legenda, escrita a partir de **um** modelo que não inclui a
URL (no Instagram ela não é clicável, e gastaria 60 caracteres com um endereço
que ninguém consegue tocar). No envio, `SocialPost.captionFor("FACEBOOK")`
acrescenta o link — e não o acrescenta se a pessoa já o escreveu na legenda à
mão. A diferença entre as redes fica em uma função pura e testada, não num
segundo texto guardado.

**D11 — Duas permissões, não uma.** `social:publish` (aprovar e publicar) é
EDITORIAL e o EDITOR tem — senão a fila para toda vez que o admin não estiver
on-line. `social:manage` (conectar/desconectar conta) é CREDENCIAL e fica só com
o ADMIN. É a mesma divisão que já existe entre `analytics:view` e `audit:view`.

**D12 — Os limites da Meta vivem no domínio.** 2200 caracteres, 30 hashtags, 10
imagens: são a régua que decide se o post pode ir ao ar, e ela responde **antes**
do clique. Descobri-los pelo erro 400 da Meta significaria a redação escrever a
legenda inteira para perdê-la no envio.

**D13 — A cota de publicação é lida, não cravada.** A documentação de publicação
fala em 100 posts/24 h, mas o endpoint `content_publishing_limit` devolve
`quota_total` **por conta** (o exemplo da própria referência mostra 50). O
adapter consulta; não chuta.

**D14 — A trava de duplicata é DUPLA: código e banco.** *(F2)* O caso de uso
pergunta `existsForArticle` antes de criar; o banco tem índice único sobre
`autoKey` (o `articleId`, preenchido só no post automático — em Postgres um
índice único ignora nulos, então posts manuais continuam ilimitados por
matéria). A primeira trava cobre o caminho normal sem depender de exceção de
constraint; a segunda cobre a CORRIDA, que aqui não é hipótese: o outbox entrega
*ao menos uma vez* e o relay pode rodar duas vezes em paralelo. É a mesma
duplicidade que `poll_vote` já usa.

**D15 — A entrega roda FORA da requisição HTTP.** *(F2)* `social.approve` tranca
o post em `PUBLICANDO` e devolve na hora; quem fala com a Meta é a tarefa
`publish-social` do agendador, a cada 5 minutos. Publicar pode levar minutos
(carrossel é N+2 chamadas com espera de processamento), e dentro da requisição
do painel isso vira timeout — possivelmente com o post já publicado do lado de
lá e o nosso banco achando que falhou. De quebra, o Inngest traz o retry com
backoff.

**D16 — O worker grava a cada entrega, não no fim.** *(F2)* Se o processo morrer
entre o Instagram e o Facebook, o que já saiu está gravado com seu `remoteId`, e
a próxima rodada não o reenvia. Salvar só no fim transformaria uma queda em post
duplicado.

**D17 — Sem adapter da Meta, o publisher RECUSA e diz por quê.** *(F2)* A
tentação era um dublê devolvendo sucesso para a demonstração ficar bonita. A
fila mostraria "PUBLICADO" em posts que não existem em rede nenhuma, e alguém
confiaria nisso. Uma fila honesta cheia de "falta conectar" é melhor que um
painel que mente.

---

## 5. Modelo de domínio

`packages/contexts/social` — contexto novo, isolado, sem dependência de npm
além do shared-kernel.

```
SocialPost (agregado)
├── id, articleId?, origin (AUTOMATICA | MANUAL)
├── Caption (VO) ......... texto, medido em pontos de código; hashtags; menções
├── mediaIds[] ........... 1 = foto, 2..10 = carrossel; a ORDEM é conteúdo
├── linkUrl? ............. só o Facebook usa
├── Delivery[] ........... uma por rede
│   └── platform, status, remoteId, permalink, error, attempts, lastAttemptAt
└── status ............... derivado das entregas, nunca atribuído de fora

SocialAccount (entidade)
└── platform, remoteId, displayName, tokenExpiresAt?, status
    (o TOKEN não está aqui — D9)
```

Máquina de estados do post:

```
RASCUNHO ──approve()──► PUBLICANDO ──┬─► PUBLICADO  (todas aceitaram)
   │                                 ├─► PARCIAL    (uma aceitou, outra não)
   │                                 └─► FALHOU     (nenhuma aceitou)
   │                                         │
 cancel()                           retryFailed() ─► PUBLICANDO
   ▼                                      (só as que falharam voltam)
CANCELADA
```

**Portas (o único contato com o mundo):**

| Porta | Papel |
|---|---|
| `SocialPublisher` | `publish(request)` — nada de container, `creation_id` ou `media_publish` aparece aqui; essas são palavras da Meta |
| `SocialImageSource` | id da biblioteca → JPEG público na proporção pedida |
| `SocialPostRepository` | inclui `existsForArticle` — a trava contra duplicata do outbox |
| `SocialAccountRepository` | separa `save` (agregado) de `storeToken`/`credentialsFor` (segredo) |

---

## 6. O App na Meta — passo a passo (D4)

Escrito para ser seguido por quem tem acesso à conta do veículo, sem
programador. **Cada passo depende do anterior.**

### 6.1 Pré-requisitos (fora do código, e sem eles nada funciona)

1. **Conta do Instagram Professional.** No app: *Configurações → Tipo de conta →
   Mudar para conta profissional*. Conta pessoal **não tem** API de publicação —
   não é limitação nossa.
2. **Página do Facebook** do veículo, com o usuário como administrador.
3. **Instagram vinculado à Página.** Na Página: *Configurações → Contas
   vinculadas → Instagram*. É esse vínculo que faz um login só devolver as duas
   redes.
4. **Meta Business Suite** (business.facebook.com) com a Página e a conta do
   Instagram dentro do mesmo Portfólio Empresarial.

### 6.2 Criar o App

1. developers.facebook.com → *Meus Apps* → **Criar app**.
2. Caso de uso: **"Outro"** → tipo **Empresarial (Business)**.
3. Vincular ao Portfólio Empresarial do passo 6.1.4.
4. Adicionar os produtos: **Instagram** (Instagram Graph API / API com login do
   Facebook) e **Login do Facebook para Empresas**.

### 6.3 Configurar o login

- **URI de redirecionamento OAuth válido:**
  `https://<dominio-do-portal>/api/social/meta/callback`
  (e `http://localhost:3001/api/social/meta/callback` para desenvolvimento).
- **Escopos pedidos:**

  | Escopo | Para quê |
  |---|---|
  | `pages_show_list` | listar as Páginas do usuário |
  | `pages_read_engagement` | ler dados da Página |
  | `pages_manage_posts` | publicar no feed da Página |
  | `instagram_basic` | identificar a conta do Instagram |
  | `instagram_content_publish` | publicar no Instagram |
  | `business_management` | listar Páginas que pertencem a um Portfólio Empresarial — sem ele, o login termina com a lista vazia *(acrescentado na F4)* |

### 6.4 O fluxo de tokens (o que o F4 implementa)

```
1. Usuário clica "Conectar" → dialog/oauth da Meta com os escopos acima
2. Volta com token CURTO (1 h)
3. Servidor troca por token LONGO de usuário (60 dias):
   GET /oauth/access_token?grant_type=fb_exchange_token&client_id=…&client_secret=…
4. GET /me/accounts?fields=id,name,access_token,instagram_business_account
   → devolve a Página, o TOKEN DE PÁGINA e o id da conta do Instagram
5. O token de Página de longa duração NÃO EXPIRA (só é invalidado se a senha
   mudar, o acesso for revogado ou o app for removido)
```

É o passo 4 que justifica a escolha do login do Facebook em vez do login do
Instagram: **uma autorização só devolve as duas redes.**

### 6.5 Publicar

**Instagram, foto:**
```
POST /<IG_ID>/media?image_url=<URL_PUBLICA_JPEG>&caption=<LEGENDA>  → creation_id
POST /<IG_ID>/media_publish?creation_id=<ID>                        → ig_media_id
```

**Instagram, carrossel (N+2 chamadas):**
```
POST /<IG_ID>/media?image_url=…&is_carousel_item=true   (uma por imagem)
POST /<IG_ID>/media?media_type=CAROUSEL&children=[…]&caption=…
POST /<IG_ID>/media_publish?creation_id=…
```

**Facebook, foto na Página:** `POST /<PAGE_ID>/photos` com `url`, `message` e o
token de Página. Múltiplas imagens: subir cada uma com `published=false` e
juntá-las em `POST /<PAGE_ID>/feed` com `attached_media`.

**Regras que mordem:**

- A imagem precisa estar em **URL pública** — a Meta baixa, não recebe upload.
- **JPEG é o único formato** aceito pelo Instagram.
- O container **expira em 24 h** se não for publicado.
- Status do container: `GET /<CONTAINER_ID>?fields=status_code` →
  `IN_PROGRESS` · `FINISHED` · `ERROR` · `EXPIRED` · `PUBLISHED`. A Meta
  recomenda consultar **uma vez por minuto, por no máximo 5 minutos**.
- Cota: `GET /<IG_ID>/content_publishing_limit` (D13).

### 6.6 App Review

Todo escopo além de `public_profile` exige **App Review + verificação de
negócio**. Enquanto o app está em modo de desenvolvimento, só contas com papel
no app (administrador, desenvolvedor, testador) conseguem publicar — o que é
suficiente para desenvolver e demonstrar. **Sem a review, não há produção.**
Por ser prazo de terceiro, é o item que deve ser iniciado **em paralelo** com
F2/F3, não depois.

---

## 7. Contratos de API (F2)

```ts
social.queue          // lista a fila, filtrada por status   (social:publish)
social.get            // um post, com impedimentos e entregas (social:publish)
social.createDraft    // post avulso                          (social:publish)
social.update         // legenda, imagens, redes (só RASCUNHO)(social:publish)
social.approve        // tranca e envia                       (social:publish)
social.retry          // reenvia SÓ o que falhou              (social:publish)
social.cancel         // descarta o rascunho                  (social:publish)
social.accounts       // contas e estado dos tokens           (social:manage)
social.disconnect     // desliga a conta                      (social:manage)
```

O envio em si **não** acontece dentro da mutação `approve`: ela tranca o post e
devolve. Quem chama a Meta é uma tarefa do `Scheduler`/Inngest, que já traz
retry com backoff — chamada de rede dentro de requisição HTTP do painel é o
caminho curto para um timeout com o post em estado indefinido.

---

## 8. Telas (F3)

1. **`/dashboard/social`** — a fila. Cartões com prévia (imagem + legenda como
   aparecerá), origem, matéria de origem, e os botões *Aprovar* · *Editar* ·
   *Descartar*. Badge com o total pendente na navegação.
2. **Editor do post** — legenda com contador por rede (vermelho ao estourar),
   troca de imagem pela biblioteca, ordenação do carrossel por arrastar,
   seleção de redes. Os impedimentos aparecem **acima do botão**, não depois do
   clique.
3. **`/dashboard/social/contas`** — quem está conectado, desde quando, estado do
   token (com aviso 7 dias antes de vencer) e o botão de reconectar.

---

## 9. Casos de teste

**Unitários** (`packages/contexts/social/tests/unit/`) — domínio, casos de uso,
gatilho, worker e cifragem:

- segundo `approve()` é recusado — o cadeado (D7)
- entrega publicada nunca muda de `remoteId`, nem sob `recordSuccess` repetido
- `retryFailed` devolve à fila só o que falhou; o `remoteId` do que deu certo
  permanece, e uma segunda rodada do worker não reenvia ao Facebook
- `PARCIAL` quando uma rede aceita e a outra não
- legenda de 2201 caracteres barra o Instagram e passa no Facebook
- emoji conta como um caractere, não como dois
- o mesmo evento `ArticlePublished` duas vezes gera **um** post; um post manual
  sobre a mesma matéria não bloqueia o automático
- matéria sem capa gera rascunho assim mesmo, com o impedimento à vista
- token vencido e conta ausente falham **sem gastar chamada na Meta**
- imagem sumida da biblioteca aborta a entrega (carrossel com buraco é pior que
  nada)
- o REDATOR não cria nem aprova, e a permissão é checada antes de ir ao banco
- o texto cifrado não contém o token, muda a cada cifragem, e adulterá-lo faz a
  decifragem falhar

**Integração** (`tests/integration/`, Postgres real via Testcontainers) — 13
casos sobre o que só o banco prova:

- o índice único RECUSA um segundo post automático da mesma matéria, e aceita
  quantos manuais quiserem
- o evento entra no outbox na mesma transação do post
- tirar uma rede do rascunho apaga a entrega dela
- o token fica cifrado na coluna, e `save` do agregado **não o apaga**
- reconectar a mesma rede substitui a conta anterior (D5)

A escrever na F4: contrato do `SocialPublisher` (fake ↔ Meta) e E2E da fila.

---

## 10. Critérios de aceite

- [x] Segundo clique em "Aprovar" **não** gera segundo post — provado em teste
- [x] Reenviar post parcial não duplica o que já foi publicado
- [x] Os limites da Meta são verificados antes do envio, com o motivo na tela
- [x] Cobertura do domínio ≥ 95%
- [x] O mesmo `ArticlePublished` entregue duas vezes gera **um** post — em
      código e no índice único do banco (D14)
- [x] Matéria publicada entra na fila pelo outbox, sem o editorial saber que
      redes sociais existem
- [x] Falha do Instagram não impede o Facebook, e a tela diz o que houve
- [x] O token é cifrado em repouso e não aparece em nenhum DTO do tRPC
- [x] Nada além do adapter conhece o vocabulário da Meta — verificado pelo
      `dependency-cruiser`
- [x] A fila aparece no painel, em "Redes sociais", para EDITOR e ADMIN (F3)
- [~] Aprovar publica de verdade nas duas redes, com o link do post salvo — implementado e testado contra uma Graph API simulada; **não exercitado contra a Meta real** (depende do App — roteiro em §14.3)
- [x] Token vencendo avisa 7 dias antes na aba Contas (F3)
- [x] A capa é cortada em 1:1 respeitando o ponto focal, em JPEG 1080×1080 (F4)

---

## 11. O que a F2 deixou pronto e onde

| | Arquivo |
|---|---|
| Tabelas e migração | `packages/db/prisma/schema/social.prisma` · `migrations/20260911210124_redes_sociais` |
| Repositórios | `packages/contexts/social/src/infrastructure/prisma-social-*.ts` |
| Cifragem do token | `.../infrastructure/token-cipher.ts` |
| Casos de uso | `.../application/{manage-posts,manage-accounts,draft-from-article,publish-pending}.ts` |
| Gatilho | `packages/api/src/social-trigger.ts` + a assinatura em `editorial.ts` |
| Raiz de composição | `packages/api/src/social.ts` |
| API | `packages/api/src/routers/social.ts` (`social.*`) |
| Tarefa de envio | `publish-social`, em `packages/api/src/scheduler.ts` |

## 12. O que a F3 entregou

Tela `/dashboard/social`, no grupo **Redação** do menu (`social:publish`), em
duas abas:

| | Arquivo |
|---|---|
| Página e abas | `apps/web/src/app/(app)/dashboard/social/{page,social-manager}.tsx` |
| Fila em cartões | `.../social-queue.tsx` — filtro por estado (começa em "Aguardando aprovação"), aprovar, revisar, descartar, tentar de novo, link para o post publicado |
| Editor do post | `.../post-dialog.tsx` — redes, legenda com contador por rede, imagens com ordem do carrossel, link, impedimentos acima do botão |
| Contas | `.../accounts-panel.tsx` — estado da autorização, aviso de vencimento, desconectar (só `social:manage`) |
| Lógica pura | `.../social-labels.ts` + `apps/web/tests/unit/social-labels.test.ts` |

Decisões da tela:

- **Cartões, não tabela.** O que se aprova é visual — imagem e legenda como vão
  sair. Uma célula truncada esconderia justamente isso.
- **"Aprovar e publicar" grava antes de aprovar.** Aprovar publica o que está no
  banco; sem a gravação, uma correção de última hora na legenda não iria ao ar.
- **Os botões dependem do estado** (`availableActions`, testado): enquanto envia,
  nenhum — inclusive nenhum "cancelar", que mentiria sobre uma chamada à Meta que
  já pode ter saído.
- **O contador usa o `Caption` do domínio**, a mesma contagem por pontos de
  código do servidor. Um `text.length` na tela divergiria justamente no emoji.
- **Sem botão "Conectar" até a F4.** A aba Contas explica que a conexão depende
  do App aprovado pela Meta, em vez de oferecer um fluxo que não existe (D17).

**Verificação:** typecheck e lint verdes; 16 testes da lógica da tela. No
servidor de dev, a rota responde (redireciona para o login sem sessão) e o
`social.*` está montado e protegido. **A tela autenticada não foi exercitada no
navegador** — exige login, que não é feito pela automação. O E2E da fila está
registrado como `test.fixme` em `apps/web/tests/e2e/social.spec.ts`.

## 13. O que a F4 entregou

**Adapter real** — `packages/contexts/social/src/infrastructure/meta/`:

| Arquivo | Papel |
|---|---|
| `graph-client.ts` | Cliente mínimo da Graph API sobre `fetch`, sem SDK; extrai o erro da Meta (código, subcódigo, frase de usuário, transitório) |
| `graph-errors.ts` | Traduz o erro para português e decide se vale repetir (190 revogado, 10/200 permissão, 4/17/32/613 limite, 1/2 instabilidade, 9004 download, 36000 tamanho) |
| `meta-social-publisher.ts` | Instagram (foto e carrossel, com espera do container) e Página (foto e álbum com `attached_media`) |
| `meta-oauth.ts` | URL do login (fluxo de código), troca por token longo e lista de Páginas com o Instagram vinculado |

**Login da Meta** — `apps/web/src/app/api/social/meta/{connect,callback}/route.ts`:

1. `connect` confere `social:manage`, gera o `state` anti-CSRF num cookie e manda para o diálogo.
2. `callback` confere o `state`, troca o código por token de usuário longo e o guarda **cifrado, por 10 minutos**, num cookie `httpOnly` restrito a `/api/trpc`. Nada é conectado ainda.
3. A aba Contas mostra as Páginas que a pessoa administra; ela escolhe uma, e `social.connectMetaPage` conecta a Página e o Instagram vinculado com o token da Página.

**Corte da capa** — `packages/api/src/social-image.ts` + `focalCrop` no domínio:
a geometria (maior retângulo da proporção, centrado no ponto focal e empurrado para dentro na borda) é função pura testada; o `sharp` só executa. O corte vai para o armazenamento numa chave que inclui o ponto focal, e é reaproveitado no reenvio.

Decisões da F4:

- **D18 — Fluxo de código, não de token.** O token nasce no servidor, na troca feita com o segredo do App, e nunca passa pelo navegador.
- **D19 — A Página é escolhida, não adivinhada.** Quem conecta costuma administrar várias Páginas; conectar a primeira da lista publicaria no lugar errado. O token de usuário espera a escolha num cookie cifrado de 10 minutos, e não no banco — ele abre TODAS as Páginas da pessoa.
- **D20 — Espera do container de 1 minuto, não 5.** A Meta recomenda consultar por até 5 minutos, mas a espera roda dentro de uma tarefa agendada com teto de duração. Foto fica pronta em segundos; se não ficar, a entrega falha como repetível e a próxima rodada tenta com container novo.
- **D21 — Falhar ao buscar o link não falha a publicação.** O post já está no ar; tratar "sem link" como erro faria o worker reenviar e duplicar.
- **D22 — Armazenamento instável lança; imagem apagada devolve `null`.** O primeiro é passageiro e deixa a entrega pendente para a próxima rodada; o segundo é definitivo e vira erro gravado na entrega.

**Variáveis de ambiente** — `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION` (padrão `v25.0`). Opcionais: sem elas, a tela não oferece o login e o publisher recusa dizendo por quê. Documentadas em `apps/web/.env.example`.

**Limites conhecidos, honestos:**

- **Nada foi testado contra a Meta real.** Os testes simulam a Graph API a partir da documentação (v25.0). Códigos de erro e o formato exato das respostas só se confirmam com o App criado — é o primeiro item da F5.
- **Em dev a publicação falha no download da imagem.** A Meta baixa por URL pública, e o MinIO local não é alcançável pela internet. Para publicar de verdade, o armazenamento precisa ser o R2 (ou um túnel).
- **O cookie do login pendente não é apagado depois da escolha**; ele vence sozinho em 10 minutos. O tRPC não tem acesso aos cabeçalhos de resposta, e o conteúdo é cifrado e restrito a `/api/trpc`.
- **As rotas `connect`/`callback` e o selo do cookie não têm teste automatizado** — exigem sessão e ambiente. Estão cobertos pelo roteiro manual da F5.

## 14. F5 — preparação do go-live

A F5 tem duas metades de natureza diferente. A **do código** está entregue: é
o que torna o primeiro contato com a Meta real diagnosticável e o que a Meta
exige para aprovar o App. A **de fora do código** — criar o App, conectar a
conta do veículo, publicar de verdade e passar pelo App Review — depende de
quem tem acesso às contas e é o roteiro de §14.3.

### 14.1 O que o código entregou

| Entrega | Onde |
|---|---|
| **Verificar conexão** — por rede: token válido (`debug_token`), permissões concedidas, cota do dia e armazenamento alcançável, sem publicar nada | `application/diagnose-accounts.ts`, `infrastructure/meta/meta-connection-probe.ts`, `social.diagnose`, botão na aba Contas |
| **Cota lida antes de publicar** (D13 agora implementado) | `infrastructure/meta/publishing-quota.ts`, `MetaSocialPublisher` |
| **Reenvio automático de verdade** — falha passageira fica na fila por até 3 rodadas | `SocialPost.recordFailure`, `Delivery.markRetrying`, `publishPendingPosts` |
| **Imagem em endereço interno recusada antes da Meta** | `domain/public-media-url.ts`, `publishPendingPosts` |
| **Callback de desautorização** e **callback de exclusão de dados**, com `signed_request` conferido | `apps/web/src/app/api/social/meta/{deauthorize,data-deletion}/route.ts`, `infrastructure/meta/signed-request.ts`, `application/forget-credentials.ts` |
| **Página de exclusão de dados** e seção na Política de Privacidade | `(site)/privacidade/exclusao-de-dados/page.tsx`, `(site)/privacidade/page.tsx` |

**Bug corrigido.** Até a F4, o worker ignorava o `retryable` do publisher:
toda falha virava `FALHOU` e parava, enquanto a mensagem gravada dizia "a
publicação será tentada de novo". Nenhuma era tentada. É o D23.

### 14.2 Decisões da F5

- **D23 — Quem promete nova tentativa é o agregado, não o tradutor de erro.**
  `recordFailure(…, { retryable })` mantém a entrega `PENDENTE` até
  `MAX_AUTOMATIC_ATTEMPTS` (3, a cada rodada de 5 min) e só então a marca
  `FALHOU`. As frases do `graph-errors` dizem o que houve, nunca o que vai
  acontecer — só o agregado sabe quantas tentativas já foram. `attempts` passa
  a contar **o ciclo**: o "Tentar de novo" zera, senão a entrega que esgotou as
  três desistiria na primeira instabilidade depois do clique. O evento
  `SocialPostFailed` sai só na falha definitiva.
- **D24 — Endereço interno é recusado antes de chamar a Meta.** `localhost`,
  IP de rede local e `.local` nunca serão baixados; a Meta responderia com um
  erro genérico de download, depois de gastar a chamada. É checagem de formato,
  não de alcance — um domínio público fora do ar passa e falha na Meta, o que é
  certo, porque essa falha é passageira.
- **D25 — Cota esgotada não é repetível pelo worker.** A cota volta em horas;
  as tentativas automáticas são de minutos e só queimariam o ciclo. Consulta
  de cota que FALHA não bloqueia: não saber a cota é diferente de não ter cota.
- **D26 — O pedido de exclusão apaga as credenciais das DUAS redes.** O portal
  não guarda o id do usuário da Meta que fez o login (só os da Página e do
  Instagram), e as duas contas nascem do mesmo login. Apagar a mais se desfaz
  com um novo "Conectar com a Meta"; apagar a menos manteria um token que
  alguém pediu para sumir. O registro da conta fica (o histórico aponta para
  ele); o token vira string vazia e a conta, `DESCONECTADA`.
- **D27 — O diagnóstico é leitura de `social:publish`, disparada no clique.**
  Quem aprova post precisa entender por que a fila não anda; nenhum token sai
  pela resposta. Não roda ao abrir a aba porque cada verificação consulta a
  Meta.

### 14.3 Roteiro do go-live (fora do código)

Cada passo depende do anterior. Quem executa precisa ser administrador da
Página do veículo.

1. **Pré-requisitos** — §6.1 inteiro (Instagram profissional vinculado à
   Página, as duas no mesmo Portfólio Empresarial).
2. **Criar o App** — §6.2.
3. **Configurar o App** em developers.facebook.com:
   - *Configurações → Básico*: domínio do portal; **URL da Política de
     Privacidade** `https://<dominio>/privacidade`; **URL de callback de
     exclusão de dados** `https://<dominio>/api/social/meta/data-deletion`.
   - *Login do Facebook para Empresas → Configurações*: **URI de
     redirecionamento** `https://<dominio>/api/social/meta/callback` (e o de
     localhost, se for testar em dev); **URL de callback para desautorizar**
     `https://<dominio>/api/social/meta/deauthorize`.
4. **Variáveis no ambiente de produção** (Vercel): `META_APP_ID`,
   `META_APP_SECRET` e o armazenamento apontando para o R2 (`S3_PUBLIC_URL`
   público). Em dev, sem túnel, o diagnóstico vai acusar "endereço interno" —
   é o esperado.
5. **Papel no App.** Enquanto o App está em modo de desenvolvimento, só quem
   tem papel nele (administrador, desenvolvedor, testador) consegue autorizar.
   Adicione a conta que vai conectar.
6. **Conectar.** Painel → Redes sociais → Contas → *Conectar com a Meta* →
   aceitar todas as permissões → escolher a Página do veículo.
7. **Verificar conexão.** As duas redes precisam aparecer como *Pronta para
   publicar*. Qualquer outra coisa diz o que falta — resolva antes do passo 8.
8. **Publicar de verdade**, nesta ordem, conferindo cada post nas redes e o
   link salvo na fila:
   1. post manual com uma imagem, só Facebook;
   2. o mesmo, só Instagram;
   3. carrossel com 3 imagens nas duas redes;
   4. uma matéria publicada no portal → rascunho automático → aprovar.
9. **Anotar o que divergir da documentação** (códigos de erro, formato de
   resposta) e corrigir o adapter antes da review — os testes da F4 simulam a
   Graph API a partir da documentação, e é aqui que ela se confirma.
10. **Verificação de negócio** no Portfólio Empresarial (documentos da empresa).
11. **App Review** — pedir as permissões da tabela abaixo, com um screencast
    do fluxo dos passos 6–8 (login, escolha da Página, aprovar um post, o post
    na rede).
12. **Modo Live** depois da aprovação. Refazer o passo 7.

**Justificativas para o App Review** (a revisão é em inglês):

| Permissão | Justificativa |
|---|---|
| `pages_show_list` | After Facebook Login, the newsroom admin picks which Page the news portal publishes to. We list the Pages they manage so the right one is chosen. |
| `pages_read_engagement` | Required together with `pages_manage_posts` to read the Page's basic data (name, picture) shown in the portal's connection screen. |
| `pages_manage_posts` | Editors approve each post in our dashboard; on approval we publish the article's image, caption and link to the newspaper's own Page. Nothing is posted without human approval. |
| `instagram_basic` | Identifies the Instagram professional account linked to the Page, so the dashboard shows which account will receive the post. |
| `instagram_content_publish` | On editor approval, publishes the article's cover image (or a carousel) with its caption to the newspaper's own Instagram account. |
| `business_management` | Pages owned by a Business Portfolio are only listed with this permission; without it the Page picker is empty for our client. |

### 14.4 Limites conhecidos, honestos

- **Continua sem teste contra a Meta real** — é o passo 8 do roteiro. Em
  particular: o formato de `content_publishing_limit` e a lista `scopes` do
  `debug_token` para token de Página vêm da referência, não de resposta vista.
- **O contrato de integração do `forget` foi escrito, mas não rodou**: o Docker
  estava fora do ar na sessão. Rode `pnpm test:integration` antes do merge.
- **As rotas de callback não têm teste automatizado** — a lógica sim
  (assinatura, exclusão); a cola das rotas está em `it.todo` em
  `packages/api/tests/unit/social-meta-callbacks.test.ts`.
- **O painel não expõe o erro de uma entrega que está sendo retentada** além
  do que a fila já mostra por entrega; um contador "tentativa 2 de 3" é
  conforto para depois.

## 15. Instagram do cliente pelo ambiente *(14/09/2026)*

**Pedido do cliente:** começar a automação do Instagram já, sem esperar o App
Review nem depender do botão Conectar. O Instagram é o foco; o Facebook fica
para depois.

**Como funciona.** Com `META_INSTAGRAM_ACCESS_TOKEN` e `META_INSTAGRAM_USER_ID`
no `.env`, o Instagram passa a vir do ambiente:

| Peça | Papel |
|---|---|
| `infrastructure/environment-instagram.ts` | Lê e valida as variáveis (`environmentInstagramFrom`) e decora o repositório de contas: para o Instagram, a conta e o token vêm do `.env`; o Facebook continua no banco |
| `MetaSocialPublisher` com `instagramClient` | As chamadas do Instagram vão para `graph.instagram.com` — o host do token do login do Instagram. As rotas (`/media`, `/media_publish`, status, cota) são as mesmas |
| `infrastructure/meta/instagram-login-probe.ts` | O "Verificar conexão" desse token: `GET /me` confere de quem é o token e compara com o id do `.env` |
| Aba Contas | Mostra "Configurada pelo ambiente", sem Desconectar; avisa se a validade não foi informada |

**Decisões:**

- **D28 — Token do login do Instagram, não token de Página.** Sai com um clique
  no painel da Meta e não exige Página do Facebook; o preço é valer 60 dias. O
  token de Página não expira, mas pede o Graph API Explorer e uma troca de
  tokens à mão. *(cliente, 14/09)*
- **D29 — Decorador, não repositório novo.** Worker, diagnóstico e tela
  continuam falando com a mesma porta. No go-live, trocar o `.env` pelo login
  é **apagar as variáveis** — nenhum código muda.
- **D30 — Com o modo ligado, o `.env` é a verdade.** Gravar ou desligar o
  Instagram pelo painel é ignorado/recusado: aceitar criaria uma segunda conta
  que a tela mostraria e o worker não usaria.
- **D31 — Configuração inválida desliga o modo, não o servidor.** Só uma das
  duas variáveis, id não numérico ou data inválida: o erro vai para o log com
  a frase do que corrigir, e o Instagram aparece como não conectado.
- **D32 — A validade é informada, não descoberta.** `META_INSTAGRAM_TOKEN_EXPIRES_AT`
  alimenta a mesma regra de aviso de qualquer conta (7 dias antes). Sem ela, o
  painel avisa que não vai conseguir avisar.

**Variáveis:**

```
META_INSTAGRAM_ACCESS_TOKEN="IGAA..."      # obrigatória
META_INSTAGRAM_USER_ID="17841400000000000"  # obrigatória, numérica
META_INSTAGRAM_USERNAME="radio7cidades"     # opcional, só exibição
META_INSTAGRAM_TOKEN_EXPIRES_AT="2026-11-13" # opcional, recomendada
```

**Onde pegar o token:** painel do App → *Instagram → Configuração da API com
login do Instagram* → adicionar a conta do cliente (ela precisa aceitar o
convite de testadora no Instagram) → **Gerar token**. O id numérico aparece ao
lado da conta.

**Limites honestos:**

- **Renovação é manual.** Vencido o token, gere outro e troque as variáveis.
  A Meta tem `GET graph.instagram.com/refresh_access_token`, mas o token novo
  precisaria ser gravado em algum lugar — e o `.env` não é gravável pelo
  servidor. Se a renovação virar incômodo, o próximo passo é guardar o token no
  banco, cifrado, como as contas do login.
- **O pedido de exclusão de dados da Meta não apaga o token do `.env`** — só o
  que está no banco. Quem administra o servidor precisa removê-lo.
- **Escopos não são conferidos** pelo diagnóstico: o `GET /me` não os devolve.
  Permissão faltando aparece no primeiro envio, traduzida pelo `graph-errors`.
- **O modo depende do App em desenvolvimento com a conta como testadora.** Para
  contas fora do App, continua valendo o roteiro de §14.3.

## 16. Publicação disparada na aprovação *(14/09/2026)*

**Problema:** aprovar só trancava o post; quem publicava era a tarefa
`publish-social`, a cada 5 minutos. Dependendo do minuto do clique, a espera ia
de segundos a 5 minutos — confuso para quem acabou de aprovar.

- **D33 — A aprovação ACORDA a entrega; o cron fica como rede de segurança.**
  `social.approve` e `social.retry` gravam o post e chamam
  `wakeTask("publish-social")`, que manda o evento `social/post.approved`. A
  função do Inngest tem dois gatilhos (cron e evento) e roda **fora** da
  requisição do painel — o D15 continua valendo, só a espera sumiu.
  - **Por que não publicar dentro do clique:** o mesmo motivo do D15 (timeout
    com o post já no ar e o banco achando que falhou).
  - **Por que manter o cron:** evento perdido (Inngest fora, chave ausente) não
    pode deixar o post parado; e as tentativas automáticas do D23 continuam
    andando no ritmo do cron.
  - **`wakeTask` nunca lança.** O post já foi gravado; falhar em avisar só
    atrasa a entrega até a próxima rodada, e vira aviso no log, não erro na
    tela.
- **D34 — Tarefa acordável é EXCLUSIVA, por regra do registro.** Com dois
  gatilhos, uma aprovação perto da virada do cron dispara duas execuções, e as
  duas pegariam o mesmo post: **duplicata no Instagram**. `exclusive: true` vira
  `concurrency: { limit: 1 }` na função — o limite vale para as execuções dos
  dois gatilhos juntos, e as excedentes esperam na fila. O `TaskRegistry`
  **recusa** registrar `wakeOn` sem `exclusive`: a trava mora no código, não na
  memória de quem registra.

**Produção:** o envio de evento usa a `INNGEST_EVENT_KEY` (já prevista). Sem
ela, a aprovação funciona e o post sai no cron, com aviso no log.


---

## 17. Stories do Instagram *(14/09/2026)*

A redação marca **Stories do Instagram** no editor, ao lado de Instagram e
Facebook, e a mesma aprovação põe a notícia no feed e nos Stories. Nada muda na
fila, no disparo na aprovação (§16) ou nas tentativas automáticas.

### 17.1 O que o código entregou

| Onde | O quê |
|---|---|
| `domain/platform.ts` | `SocialDestination` (`INSTAGRAM` · `INSTAGRAM_STORIES` · `FACEBOOK`), `DESTINATION_PLATFORM`, `DESTINATION_FORMAT`, `DESTINATION_LABEL`, `destinationOf`; `PLATFORM_LIMITS` passa a ser por destino, com `publishesCaption`, `images` e `imageAspect` |
| `domain/social-post.ts` | entregas por destino; `captionFor` devolve vazio nos Stories; `imagesFor` (Stories: só a primeira); impedimentos de legenda e de carrossel não valem para os Stories |
| `domain/focal-crop.ts` | proporção `9:16` (1080×1920) e `storyLayout` — onde a foto inteira fica no quadro |
| `application/publish-pending.ts` | conta pela REDE do destino, imagens e proporção pelo destino, `format` no pedido |
| `infrastructure/meta/meta-social-publisher.ts` | fluxo `media_type=STORIES` (container → espera → `media_publish` → link), com a mesma cota do feed; story fora do Instagram é recusado sem chamar a Meta |
| `packages/api/src/social-image.ts` | `renderStory`: foto inteira centrada sobre ela mesma ampliada, desfocada e escurecida |
| Router | `platforms` e o filtro aceitam destinos; o DTO da entrega traz `destination` e `platform`; `previews` traz as imagens de cada destino |
| Tela | chip "Stories do Instagram" no editor, aviso do que muda (`storyNotice`), sem contador de legenda para os Stories, botão "Ver o story (24 h)" |

### 17.2 Decisões

**D35 — Stories é DESTINO, não tipo de post.** É o D6 de novo: uma aprovação,
uma entrega por destino. O story que falha não derruba o post do feed (o post
fica `PARCIAL`), e o "Tentar de novo" reenvia só o story. Um "post de story"
separado obrigaria a aprovar duas vezes a mesma notícia.

**D36 — Rede é conta; destino é para onde vai.** `SocialPlatform` continua
sendo o que se conecta, guarda token e tem cota. O feed e os Stories do
Instagram usam a MESMA conta — `DESTINATION_PLATFORM` faz a ponte, e a
mensagem "Nenhuma conta do Instagram" continua falando da conta, não do destino.

**D37 — Nos Stories vai UMA imagem, a primeira.** Publicar um carrossel como
vários stories em sequência criaria um meio-publicado sem conserto: o terceiro
falha e o "Tentar de novo" duplicaria os dois primeiros. Um story por entrega
mantém a garantia de nunca duplicar. A tela avisa quando o post tem mais de uma
imagem.

**D38 — Sem legenda.** A API de publicação de Stories não tem campo de texto.
O destino não entra na medida da legenda (nem no impedimento, nem no contador),
e `captionFor` devolve vazio.

**D39 — A arte é a foto INTEIRA, não um corte.** Foto de notícia é quase sempre
deitada; cortada em 9:16 viraria uma fatia de um terço. O quadro 1080×1920
mostra a foto inteira centrada, e o espaço de cima e de baixo é a própria foto
ampliada, desfocada e escurecida (o fundo segue o ponto focal). O desfoque é
feito numa miniatura e ampliado: mesmo resultado, milissegundos em vez de
segundos de CPU dentro da tarefa de envio. A geometria é pura e testada
(`storyLayout`); o `sharp` só executa.

**D40 — Nenhuma migration.** A coluna `social_delivery.platform` passa a guardar
o destino. O feed de cada rede tem o nome dela, então as linhas antigas seguem
válidas; o `@@unique([postId, platform])` continua valendo (feed e story são
linhas diferentes). Os eventos mantêm os campos `platform`/`platforms` pelo
mesmo motivo — o payload já gravado no outbox e na auditoria usa esses nomes.

**D41 — Stories não entram no post automático por padrão.** O rascunho que
nasce da matéria continua indo ao feed das duas redes (`AUTO_POST_PLATFORMS`).
Story some em 24 h e não leva legenda; marcá-lo é escolha de quem aprova.
Mudar o padrão é uma linha em `packages/api/src/social.ts`.

### 17.3 Limites conhecidos

- **Sem link, figurinha ou texto.** A API não publica link sticker, enquete nem
  texto sobre o story. O que se lê no story é o que está desenhado na imagem.
  Uma arte com o título da matéria desenhado é o próximo passo natural.
- **Some em 24 h.** O link devolvido pela Meta deixa de abrir depois disso; a
  entrega continua `PUBLICADO` no histórico, com o `remoteId`.
- **Mesma cota do feed.** Story publicado por API conta no limite de 24 h da
  conta — o diagnóstico e a checagem de cota já cobrem.
- **Só imagem.** Story em vídeo depende do mesmo upload assíncrono dos Reels.
- **Stories do Facebook ficam fora** — o foco é o Instagram; o adapter recusa
  com `STORY_UNSUPPORTED` em vez de publicar no feed por engano.

### 17.4 Como testar

1. Na conta de testes (`META_INSTAGRAM_*` no `.env`), crie uma publicação com
   uma imagem e marque **Instagram** e **Stories do Instagram**.
2. Aprove. Em segundos, as duas entregas devem aparecer como "no ar"; o botão
   "Ver o story (24 h)" abre o story.
3. Confira no Instagram: o story mostra a foto inteira sobre o fundo desfocado.
   A imagem gerada fica no armazenamento em `social/<mídia>-9x16-<x>-<y>.jpg`.

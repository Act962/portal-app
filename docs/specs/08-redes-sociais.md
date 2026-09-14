# Spec — Fase 8: Redes Sociais (Instagram e Facebook)

> **Status:** 🚧 Em execução — Fatias 1 e 2 entregues em 11/09/2026 (domínio,
> persistência, gatilho, casos de uso e API); Fatia 3 (telas do painel) em 14/09/2026.
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
| F4 | Adapter real da Meta + OAuth + corte 1080×1080 da capa | ⬜ |
| F5 | App Review da Meta e go-live | ⬜ |

### Não entra (e por quê)

- **Stories e Reels.** Outra API, outro ciclo de vida (Stories somem em 24 h e
  não aceitam link clicável abaixo de 10 mil seguidores; Reels exigem upload
  assíncrono com polling de transcodificação). Cada um vale uma fatia própria
  depois que o feed estiver rodando.
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
- [ ] Aprovar publica de verdade nas duas redes, com o link do post salvo (F4)
- [x] Token vencendo avisa 7 dias antes na aba Contas (F3)
- [ ] A capa é cortada em 1:1 respeitando o ponto focal (F4)

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


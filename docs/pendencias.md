# Pendências — o que falta para o produto ficar completo

> **Atualizado:** 2026-08-13.
> Lista única e priorizada do que está em aberto, para a entrega em andamento.
> Estado por fase em [`proximos-passos.md`](./proximos-passos.md); escopo em
> [`specs/`](./specs/); operação em [`deploy.md`](./deploy.md).

**O que já funciona hoje:** o ciclo completo redação → leitor. Criar editoria e
assunto, subir imagem com ponto focal, escrever matéria em rich-text com
formatação, passar pelo workflow (rascunho → revisão → aprovada → publicada, com
agendamento e auditoria) e ver no portal público com SEO, sitemaps e RSS. Em
volta disso: equipe e permissões com convite por e-mail e redefinição de senha,
configurações do veículo, grade de programação, enquete com voto anônimo,
"mais lidas" por audiência real e o painel de insights.

---

## 🚨 Precisa de ação humana — desta rodada (2026-08-12/13)

Oito coisas que o código não resolve sozinho e que **ficam erradas em
produção até alguém agir**:

1. **O texto legal precisa de revisão de quem responde pelo veículo.**
   `/privacidade` e `/termos` foram escritos descrevendo o que o portal
   REALMENTE faz — sem conta de leitor, sem newsletter, log de leitura sem IP
   nem user-agent (N09), voto por token anônimo. É um rascunho tecnicamente
   fiel, **não é peça jurídica revisada**. Enquanto ninguém da parte do
   cliente ler e aprovar, o portal publica um documento com efeito de LGPD que
   passou só pelo desenvolvimento.

2. **O rodapé de PRODUÇÃO ainda tem os links mortos.** Os defaults mudaram
   (`institutional` agora traz só Colunistas e Enquetes; `legal` virou `null`),
   mas **default só vale para banco sem linha** — e produção tem linha. Lá
   continuam:
   - os seis institucionais com `href: ""`, que o `SiteLink` degrada para texto
     inerte (D9) — não dão clique morto, mas anunciam serviços que não existem;
   - a string `legal` "PRINCÍPIOS EDITORIAIS · PRIVACIDADE · TERMOS DE USO",
     que **parece um menu e é texto impresso**. Pior agora do que antes: as
     páginas de Privacidade e Termos EXISTEM e estão logo acima, em
     "Institucional", então o leitor vê os mesmos três nomes duas vezes — uma
     clicável e outra não.

   Conserto: abrir Configurações → Rodapé, limpar os institucionais que não
   têm destino e esvaziar a linha legal (ou trocá-la pela razão social, que é
   para o que o campo passou a servir). É clique, não deploy.

3. **`AWESOMEAPI_TOKEN` cadastrado (13/08) — falta o redeploy e a conferência.**
   A faixa subiu e **não apareceu em produção**: o log da Vercel mostrou
   `[cotacoes] a API respondeu 429` em toda visita. O erro de julgamento foi
   raciocinar pelo NOSSO volume (uma chamada por minuto, folgada nos 100 do
   acesso anônimo) — mas o limite é **por endereço IP**, e os IPs de saída da
   Vercel são compartilhados com outros clientes: a cota se esgota por uso de
   terceiros.

   O token já está nas variáveis de ambiente. **O que falta:** um deploy novo
   — variável cadastrada não alcança o que já está no ar — e abrir qualquer
   página para ver os três valores no cabeçalho. Detalhe e como diagnosticar
   se ainda vier vazio na seção "Dívida gerada pelo rebranding", mais abaixo.

4. **A licença da Open-Meteo (temperatura do cabeçalho) precisa de decisão.**
   O plano gratuito é declarado para uso NÃO COMERCIAL e o portal é de uma
   rádio comercial. Não é volume — é licença. Ou assina o plano comercial
   deles, ou troca de provedor (INMET e CPTEC/INPE são públicos e brasileiros).
   A troca custa pouco: só `data/weather.ts` conhece a fonte, e o módulo puro
   com os testes continua valendo.

5. **`setup.md` §3.2 e a linha do `.env` na dívida técnica estão invertidos.**
   Eles dizem que a `S3_PUBLIC_URL` local aponta para o R2 (para as capas do
   seed aparecerem). No `.env` desta máquina os sete `S3_*` apontam para o
   MinIO — o oposto. O efeito também inverteu: upload local funciona e abre
   normalmente; quem dá 404 agora são **as capas do seed**, que moram no R2.
   Conferido no navegador: `uploads/…` responde 200, as chaves do seed dão
   `ERR_BLOCKED_BY_ORB`. Alguém precisa decidir qual dos dois é o combinado e
   corrigir o doc — hoje ele manda o próximo desenvolvedor para o lado errado.

6. **O portal precisa ser cadastrado no Google (13/08, spec 07).** O código
   agora emite tudo o que o buscador pede — canônicas, Open Graph com imagem,
   `NewsArticle`, sitemaps com `lastmod` e imagem, `robots.txt`. Nada disso
   indexa nada sozinho:
   - **Search Console:** criar a propriedade de `fm7cidades.com`, pegar o código
     de verificação e cadastrá-lo como `GOOGLE_SITE_VERIFICATION` na Vercel (a
     variável é opcional; sem ela nenhuma tag é emitida). Depois, enviar
     `https://fm7cidades.com/sitemap.xml`.
   - **Google News (Publisher Center):** é um cadastro MANUAL e uma aprovação
     editorial — o `news-sitemap.xml` não substitui isso. Sem o cadastro, o
     portal não entra em Notícias nem no carrossel de Top Stories, por mais
     correta que esteja a marcação.

   Enquanto os dois não forem feitos, o efeito de toda esta entrega é
   invisível — e é o único passo que não dá para fazer por código.

7. **O bucket do R2 precisa de domínio próprio (13/08).** `S3_PUBLIC_URL` em
   produção aponta para `pub-….r2.dev`, que é o *Public Development URL* — a
   Cloudflare documenta que ele **não é para produção**: limite de taxa variável
   (`429`), banda estrangulada, e sem cache nem WAF.

   Conviver com isso era possível enquanto só o leitor com a página aberta
   buscava imagem. Deixou de ser: com a spec 07, quem busca também é o
   **Googlebot-Image** (extensão de imagem no sitemap), o fetcher do
   **WhatsApp/Facebook** (`og:image`) e os leitores de **RSS** (`<enclosure>`).
   Imagem que responde 429 vira prévia sem foto e matéria fora do Google
   Imagens, sem erro nenhum no portal.

   **O que fazer:** *R2 → bucket → Settings → Custom Domains*, ligar algo como
   `midia.fm7cidades.com`, e trocar `S3_PUBLIC_URL` na Vercel. Nenhuma linha de
   código muda, e as capas já gravadas continuam válidas — o banco guarda a
   chave do objeto, não a URL. Passo a passo em [`deploy.md`](./deploy.md) §0,
   passo 2.4.

8. **A identidade nova (13/08) deixou três pontas com o cliente.** O portal
   passou a ser o **Portal 7 Cidades**, em marrom (`#3A1F0E` / `#7B5723`). O
   código está inteiro; o que falta não é deploy:

   - **O logo das Configurações está com a arte ERRADA** (verificado em
     13/08, depois da atualização). Os dois campos — logo e favicon — apontam
     hoje para o mesmo arquivo, o `FAVICON_portal_7_cidades.png`. Essa arte foi
     desenhada para ir **sobre fundo colorido**: o miolo do "7" é vazado. No
     rodapé, que é marrom, ela funciona. Nos lugares em que o `logoUrl` é
     consumido — `Organization.logo` do schema.org (`lib/structured-data.ts`) e
     `<image>` do RSS (`lib/feed.ts`) — o fundo é **branco**, e aí sobra só o
     crescente dourado: o "7" desaparece.

     Conserto, em Configurações:
     - **Logo** → `logo_7_cidades.png` (o lockup completo, que lê sobre branco).
     - **Favicon** → ou limpar o campo, e aí entra o `/brand/favicon.ico` novo
       (a mesma arte já achatada sobre o marrom, em 16·32·48·256), ou subir
       `apps/web/public/brand/icon-512.png`, que é essa versão achatada.

     O `og:image` **não** é afetado: ele vem do campo de arte social ou do
     cartão gerado pela rota `/og`, nunca do logo.
   - **O nome do veículo continua "Rádio 7 Cidades"** nas Configurações,
     enquanto a marca entregue diz "Portal Cidades". O cabeçalho mostra a arte,
     mas `<title>`, Open Graph e schema.org mostram o nome do banco — e os dois
     se contradizem em toda prévia de link. É um campo de formulário; a decisão
     do nome é do cliente, não nossa.
   - ~~**Falta a arte HORIZONTAL do lockup, em branco.**~~ ✅ Chegou em 14/08,
     nas duas versões: `logo_7_cidades_hor.png` (colorida, para fundo claro) e
     `logo_7_cidades_hor_ver.png` (o marrom trocado por branco, para fundo
     escuro). A segunda virou `public/brand/logo-horizontal.png` e substituiu a
     assinatura que era composta em Montserrat — `site-logo.tsx` é um `<Image>`
     agora, sem filtro de cor. A colorida segue como arte-mestre, não servida:
     os dois lugares onde a marca aparece são marrons.

---

## Dívida gerada pelo rebranding (13/08) — nossa, não do cliente

A entrega da identidade abriu quatro frentes. **Três foram fechadas na mesma
rodada**; sobra uma, e ela é do cliente.

### ✅ Resolvido — a navegação tem teste

Com a trilha de editorias fora do layout, chegar a qualquer editoria passou a
depender de um painel que só existe depois da hidratação — e o único teste de
home checava a manchete, que não depende do menu. Um erro de hidratação deixaria
o portal sem navegação com o CI verde.

`apps/web/tests/e2e/home.spec.ts` ganhou seis testes de verdade: abre, lista as
editorias, navega e fecha, fecha ao clicar na rota em que já se está (o caso que
um efeito observando a rota NÃO cobriria), Esc devolve o foco ao botão, e o
rodapé mantém as editorias no HTML servido sem nenhuma interação — que é o que
sustenta a linkagem interna para o rastreador. Suíte E2E em 12 verdes.

Eles não fixam nome de editoria: leem a primeira que o painel lista. O seed do
E2E tem só "Cidades" e o de desenvolvimento tem sete — asserção presa a conteúdo
de seed vira falha vermelha quando o dado muda, que é ruído, não defeito.

### ✅ Resolvido — o JS do portal voltou ao que era

Medido servindo o build de produção e somando os scripts que o HTML da home
referencia, comprimidos:

| | bruto | gzip |
|---|---|---|
| `main` (antes) | 640,4 KB | **190,8 KB** |
| com o `Sheet` no pacote inicial | 769,9 KB | **234,2 KB** |
| com o painel sob demanda | 640,4 KB | **190,8 KB** |

O diálogo do Base UI custava **+43,4 KB comprimidos em toda página pública** por
um menu que a maior parte dos leitores nunca abre. O painel virou
`site-menu-panel.tsx`, carregado por `next/dynamic`, e o botão ficou com alguns
bytes. O `preload` dispara no `pointerenter` e no `pointerdown` — os dois antes
de o clique se completar —, então a primeira abertura não paga ida à rede.

**Fica registrado o que a medição revelou de passagem:** a home já estava em
190,8 KB antes desta entrega, contra os 150 KB que o `ui-ux.md` §4 fixa. O
rebranding não criou esse estouro e agora não o piora, mas ele existe e nada no
CI o verifica — o Lighthouse CI que travaria isso continua fora do pipeline.

### ✅ Resolvido — o favicon é da marca nova

`favicon.ico` regerado com a arte do cliente (16·32·48·256, chapada sobre o
`#3A1F0E`), junto com os ícones de manifest e de tela inicial. O `sharp` não
escreve `.ico`, então o contêiner é montado à mão em
[`design/marca/gerar-assets.mjs`](../design/marca/gerar-assets.mjs) — com cada
imagem embutida como PNG, que todo navegador lê desde o IE11 e dispensa o
cabeçalho DIB e a máscara AND, que é onde esse tipo de gerador erra.

O símbolo do cabeçalho virou arquivo próprio (`symbol.png`, transparente): o
masthead o pintava de branco por filtro, e a arte chapada viraria um quadrado
branco. São exigências opostas — ícone de tela inicial **não** pode ser
transparente, porque Android e iOS compõem sobre branco ou preto por conta
própria.

**Desde 14/08 o masthead não usa mais o `symbol.png`**: com a chegada do lockup
horizontal, cabeçalho e rodapé passaram a servir `logo-horizontal.png` inteiro,
sem filtro. O símbolo continua sendo gerado — é a marca reduzida, e o primeiro
candidato para onde não couber a assinatura —, mas hoje nenhuma página o pede.

### ⏳ Falta confirmar no ar — as cotações agora são de toda página

Elas subiram para a barra do topo, que está na moldura. Não multiplica
requisição (o `unstable_cache` de `data/quotes.ts` guarda inclusive a falha),
mas muda o alcance do item 3 desta lista: sem o `AWESOMEAPI_TOKEN`, o que fica
vazio em produção deixou de ser uma faixa da home e passou a ser um pedaço do
cabeçalho do site inteiro.

**O token foi cadastrado na Vercel em 13/08.** O caminho do código foi conferido
e está certo: a variável é opcional no schema (`packages/env/src/server.ts`), e
`data/quotes.ts` a anexa como `?token=` com `encodeURIComponent`. Faltam duas
coisas antes de riscar esta linha:

1. **Redeploy.** Variável de ambiente na Vercel só vale para deploys NOVOS — o
   que está no ar hoje continua rodando sem ela, por mais que o painel já a
   mostre cadastrada.
2. **Conferir no ar.** Abrir qualquer página do portal (a faixa agora é do
   cabeçalho, não só da home) e ver os três valores. Se ainda estiver vazia, o
   log da Vercel diz o motivo em uma linha — `[cotacoes] a API respondeu …` —,
   e com o token presente a mensagem já não acusa o limite anônimo.

O cache é de 5 minutos e guarda também a falha, então uma leitura ruim
imediatamente antes do deploy não persiste: o deploy novo começa com cache
limpo.

### Área de patrocinadores — ADIADA pelo cliente (12/08)

O espaço da antiga "TV 7 Cidades" chegou a ser reservado para uma faixa de
patrocinadores, mas **o cliente decidiu adiar** e o lugar foi ocupado pela
faixa de cotações. Fica registrado o que já estava pensado, para não se
redescobrir depois:

- Não é o mesmo que o Bloco C (banners/`advertising`), e confundir os dois é o
  erro caro aqui. **Banner** é peça publicitária com período, criativo e
  posição — o `AdSlot` já reserva 9 lugares e o que falta é o contexto
  `advertising`. **Patrocinador** é uma FAIXA DE MARCAS: logo, nome e link,
  sem período nem criativo, permanente enquanto durar o contrato.
- Se forem a mesma coisa para a rádio, vira uma posição a mais no
  `advertising` e não custa contexto novo. Se forem diferentes, é um cadastro
  próprio — mais barato que o de banners, por não ter agendamento nem métrica.
  **É essa a pergunta que decide o tamanho do trabalho.**
- **Onde ficaria agora:** o lugar de antes está tomado. O candidato natural é
  logo ABAIXO da faixa de cotações, antes dos colunistas — é o mesmo nível da
  página e não briga com a cobertura, que ocupa o topo.

---

## 🔧 Configuração de produção — ✅ CONCLUÍDA (2026-08-07)

Variáveis cadastradas na Vercel e R2 configurado; portal no ar e funcionando.
Ficam registrados só os pontos que **não** se provam olhando a tela:

- **"Mais lidas" com `REDIS_URL` errada não parece quebrada** — a seção continua
  ali, listando as mais recentes. A conferência é comportamental: abrir uma
  matéria antiga várias vezes e ver se ela sobe no ranking em até 24h.
- **Agendamento** — a prova é uma matéria marcada para dali a poucos minutos
  saindo sozinha, e a execução aparecendo no painel do Inngest. "O deploy subiu"
  não prova nada aqui.
- **Domínio próprio quebra o upload de imagem.** No dia em que trocar o
  `*.vercel.app` pelo domínio da rádio, a origem nova precisa entrar no CORS do
  bucket R2 — senão o envio volta a travar em 0%, com o mesmo sintoma de antes.
- `RESEND_API_KEY` segue **opcional**: sem ela, convite e redefinição de senha
  continuam no "avise você mesmo", que funciona mas é manual.

---

## 👀 Aceite visual — ✅ CONCLUÍDO (2026-08-11)

As seis telas foram abertas uma a uma, com o seed carregado. **O exercício se
pagou:** achou três defeitos que nenhum teste pegava, todos corrigidos no mesmo
dia. É a prova de que testes provam comportamento, não legibilidade.

- [x] **Assuntos/Tags** (`/dashboard/taxonomy`) — as duas abas conferidas. Ao
      apagar, a tela diz o que importa: *"As matérias continuam existindo — só
      deixam de ser agrupadas por este assunto, e a página dele sai do ar."* As
      setas de ordenação estão corretas nos extremos (primeira linha sem
      "subir", última sem "descer") — conferido no DOM, porque a diferença
      visual entre habilitado e desabilitado é sutil em tamanho real.
- [x] **Programação** (`/dashboard/programacao`) — vista vazia e com grade
      cheia (14 programas nos sete dias, cadastrados pela própria tela). Vazia,
      explica o card oculto em vez de parecer defeito: *"A grade aparece no
      portal assim que houver programas cadastrados."* Cheia, o card do portal
      aparece com os programas do dia e o selo **"no ar"** calculado contra o
      relógio.
- [x] **Insights** (`/dashboard/insights`) — estados vazios comunicam bem
      ("Ainda sem leitura medida no período"). **Um defeito aqui**, ver abaixo.
- [x] **Enquetes** (`/dashboard/enquetes`) — a tela e o estado vazio. O fluxo
      rascunho → publicar → votar anônimo já é coberto por `T13` no e2e, que é
      onde ele se prova de verdade.
- [x] **Configurações** (`/dashboard/settings`) — a aba "Rádio" confirmada no
      escopo novo: sobraram frequência e faixa, o campo de transmissão saiu.
- [x] **Biblioteca de mídia** (`/dashboard/media`) — o painel de detalhe está
      bem resolvido, e **a recusa da D4 funciona**: excluir uma imagem que é
      capa devolve *"Este arquivo está em uso por uma matéria. Troque a imagem
      na matéria antes de excluir."*, e o arquivo continua lá. **Um defeito
      aqui**, ver abaixo.

### Os três defeitos que só o olho pegou

1. **Marca duplicada no eixo Y do gráfico de Insights.** Com o período todo
   zerado — ou seja, **em toda instalação nova** —, `max` cai no piso `1` e as
   três marcas viram `[0, Math.round(0.5), 1]` = `[0, 1, 1]`. Como cada marca é
   um `<g key={tick}>`, a chave repetida fazia o React descartar uma delas: o
   eixo perdia uma marca em silêncio, e o console acusava *two children with the
   same key*. A aritmética saiu do componente para
   `components/admin/insights/scale.ts` (`yAxisTicks`), com teste — inclusive um
   que varre `max` de 1 a 200 afirmando que as marcas nunca repetem.
2. **Imagem quebrada sem quadro de reserva na biblioteca.** Quando o arquivo não
   resolvia, o card caía no quadro quebrado do navegador com o texto alternativo
   solto, e a caixa de seleção — que é `absolute` — passava por cima das
   primeiras letras. Virou `components/media/asset-image.tsx`, usado nos quatro
   pontos que renderizam imagem de acervo. Não é caso hipotético: acontece com
   arquivo apagado do bucket e com a troca de `S3_PUBLIC_URL` descrita na dívida
   técnica abaixo.
3. **Todo separador vertical do painel estava colado no topo.** O `Separator`
   trazia `data-vertical:self-stretch`, e pela spec do flexbox `align-self:
   stretch` só estica com medida transversal `auto` — com altura definida ele
   degrada para `flex-start`. Como os cinco usos dão altura (`h-4` no topbar,
   `h-6` na barra do editor), os cinco estavam desalinhados; e como `align-self`
   é do filho, o `items-center` do contêiner não tinha como corrigir. Medido:
   0px de folga acima e 40px abaixo, num header de 56px. Corrigido no primitivo.

### Duas escolhas que ficaram para a redação decidir

- **"Produção por autor", no Insights**, escala contra o maior valor. Com todos
  os autores empatados em 1 matéria, as barras ficam todas cheias — correto pela
  régua, mas lido rápido comunica "todos no máximo".
- **A grade começa no Domingo** (`dayOfWeek` 0 é domingo, e a tabela ordena por
  ele). Se a rádio pensa a semana começando na segunda, é ordenação, não modelo.

---

## 🔴 Bloqueiam a venda / o uso real

> **Seção fechada.** As sete estão resolvidas em código. O que sobrou de B3 e B4
> é cadastro de variável e política de bucket, agrupado na seção 🔧 no topo —
> aqui fica só o registro do que foi feito e por quê.

| # | Pendência | Por que importa | Onde |
|---|---|---|---|
| B1 | ~~Qualquer um cria conta no painel~~ | ✅ **Resolvido**: o cadastro é fechado por convite, com o portão no `databaseHooks.user.create.before` do Better Auth — vale para qualquer caminho que crie usuário, não só a nossa UI. O portão é o **e-mail** (sem token). Primeiro usuário do sistema segue nascendo ADMIN. | `packages/auth/src/index.ts` |
| B2 | ~~Capa das matérias do seed~~ | ✅ **Resolvido**: o seed distribui, em rodízio, 6 imagens que já estão no bucket do R2. Depende de `S3_PUBLIC_URL` apontar para o bucket. | `packages/db/prisma/seed.mjs` (`IMAGENS`) |
| B3 | ~~Migrations no deploy~~ | ✅ **Resolvido**: `pnpm db:deploy` criado e já ligado no `buildCommand` do `vercel.json`, com guarda para não migrar o banco de produção em deploy de preview. | [`deploy.md`](./deploy.md) §1 |
| B4 | ~~R2 em produção~~ | ✅ **Código pronto** (o adapter S3 serve R2 sem mudança). O que falta é configuração, não código: variáveis e o **CORS de `PUT`** no bucket — ver seção 🔧. | [`deploy.md`](./deploy.md) §2 |
| B5 | ~~Sem recuperação de senha~~ | ✅ **Resolvido (MVP)**: o admin gera o link de redefinição em "Equipe" → "Pessoas" e entrega manualmente (mesmo padrão "avise você mesmo" do convite) — usa o fluxo nativo do Better Auth, capturado via `captureResetLink` (`AsyncLocalStorage`, sem precisar de tabela nova). O login ganhou "Esqueci minha senha", que hoje só orienta a procurar um admin — sem Mailer configurado (ver Bloco B abaixo), não há como entregar o link com segurança para quem esqueceu. | `packages/auth/src/index.ts`, `packages/auth/src/reset-link-capture.ts`, `packages/api/src/routers/identity.ts` (`users.resetPassword`), `apps/web/src/app/(app)/reset-password/` |
| B6 | ~~"Anúncios" e "Configurações" davam 404~~ | ✅ **Resolvido**: os dois itens saíram da navegação até as telas existirem. Apontavam para rotas inexistentes, e só o ADMIN — o dono do portal — os enxergava. | `apps/web/src/lib/admin-nav.ts` |
| B7 | ~~Agendamento não publicava sozinho~~ | ✅ **Resolvido**: a tarefa `publish-scheduled` roda a cada 5 min pelo **Inngest** (ADR 0007). Nasceu como cron da Vercel batendo em `/api/cron/[task]`, que continua existindo como agendador alternativo — mas o `crons` do `vercel.json` foi removido em 07/08, para haver um motorista só. Antes disso o único gatilho era um clique no painel. | [`deploy.md`](./deploy.md) §3 |

---

## 🟠 Funcionalidades combinadas e ainda não feitas

### Bloco B — Equipe e configurações
- [x] ~~**Convite** e **fechar o auto-cadastro**~~ ✅ Feito. O portão é o
      **e-mail convidado**, por decisão do cliente — sem token, o que também
      significa que convite não vaza por encaminhamento de mensagem.
- [x] ~~**Envio do convite por e-mail (Resend)**~~ ✅ Resolvido: porta `Mailer`
      (`packages/contexts/identity/src/domain/ports/mailer.ts`) com
      `NoopMailer` como padrão e `ResendMailer` (`fetch` puro, sem SDK) atrás
      de `RESEND_API_KEY`. Mesma regra do Inngest e do Redis: SaaS é peça
      trocável, nunca amarra. Sem a chave, o "avise você mesmo" continua sendo
      o comportamento — o convite não fica bloqueado por falta de provedor.
- [x] ~~**Redefinição de senha (B5)**~~ ✅ Resolvido: hook nativo
      `sendResetPassword({ user, url })` do Better Auth, mais
      `captureResetLink` (`AsyncLocalStorage`) para o admin conseguir o link
      sem precisar de e-mail. Login ganhou "Esqueci minha senha" — com Mailer
      configurado é autosserviço de verdade; sem ele, orienta a procurar um
      admin (a tela pergunta via `identity.capabilities.mailerEnabled`, para
      não fingir que enviou algo que não foi).
- [x] ~~**Redefinição de senha pelo admin**~~ ✅ Resolvido junto do item
      acima — botão "Redefinir senha" em "Equipe" → "Pessoas" gera o link e
      mostra num diálogo para copiar.
- [x] ~~**Reativar membro**~~ ✅ Resolvido: `activate()` simétrico ao
      `deactivate()` (`packages/contexts/identity/src/domain/staff-member.ts`),
      `activateStaff()` na aplicação e `users.activate` no router. Reativar
      preserva o papel de antes; reativar quem já está ativo é idempotente.
- [x] ~~**Configurações do site**~~ ✅ Entregue conforme
      [`specs/05b-configuracoes-do-site.md`](./specs/05b-configuracoes-do-site.md):
      contexto `settings` + tela em "Configurações", atrás de `settings:manage`.
- [x] ~~**Botão de play não toca nada**~~ ✅ Encerrado por **mudança de escopo**:
      a rádio se desvinculou do portal e a transmissão ao vivo saiu do produto.
      Removidos o `<audio>` e o `LivePlayerProvider`, a barra vermelha "AO VIVO",
      a pílula do cabeçalho, a página `/ao-vivo`, a env `RADIO_STREAM_URL` e o
      campo `radioStreamUrl` das Configurações (migration
      `20260807181354_drop_radio_stream_url`).
      **O que ficou:** a grade de programação (contexto `broadcast`, tela do
      painel e card da home) e a identidade "93,9 FM" no cabeçalho/rodapé — são
      informação sobre o veículo, não dependiam do player.

### Bloco C — Banners e anúncios ✅ ENTREGUE (2026-08-31)

> Contexto `advertising` novo: agregado `Campaign` (arte, link, posição,
> período, peso, editorias), configuração do AdSense, contador diário de
> impressões e cliques, tela em `/dashboard/campaigns` e `/ads.txt`. Os 9
> pontos de veiculação passaram do `AdSlot` placeholder para o `AdPlacement`
> (RSC), que serve campanha real.
>
> **As duas decisões que os docs mandavam tomar antes de escrever, e as
> respostas dadas pelo cliente:** rodízio COM PESO (não uma campanha por
> posição), e global COM segmentação opcional por editoria. Campanha
> segmentada tem prioridade sobre a global na editoria vendida — sem isso,
> quem compra "só Esportes" disputaria no peso com uma global e apareceria
> uma vez a cada onze.
>
> **Métricas saíram do "para depois"**: impressão só conta com 50% do anúncio
> na tela (régua da IAB), o rodízio é sorteado no CLIENTE (sortear no servidor
> congelaria junto com o `revalidate = 60`) e a contagem é agregada por dia,
> sem nenhum dado pessoal.

**O que ficou pendente de AÇÃO HUMANA antes de monetizar:**

1. **A política de privacidade precisa de revisão jurídica.** O texto foi
   atualizado para descrever os cookies do Google e passou a ser condicional
   (só afirma o que está realmente ligado), mas continua sem revisão de
   advogado — é o item 1 desta lista desde 12/08, agora com mais superfície.
2. **Não há banner de consentimento.** Por isso o padrão é pedir anúncios NÃO
   PERSONALIZADOS. Para tráfego da Europa o Google exige um CMP certificado,
   que não existe aqui — ligar personalização sem isso expõe o portal.
3. **`/ads.txt` só sai do ar com o `publisherId` cadastrado.** Sem ele o
   Google trata o inventário como não autorizado e a receita despenca.

#### Histórico do que era o Bloco C

> **Confirmado pelo cliente em 2026-08-10: anúncios/banners ESTÃO no contrato.**
> Deixa de ser escopo em dúvida e passa a ser entrega devida. É o maior item
> aberto — contexto novo, migration, tela de painel e troca do placeholder no
> portal. Os **9 pontos de veiculação já existem** e reservam altura (o
> `AdSlot` está em 5 formatos, em home/editoria/matéria/últimas/tag/autor e no
> cabeçalho), então o portal não muda de layout: o que falta é ter o que servir.

- [ ] Contexto `advertising` com `Campaign` (imagem, link, posição, período,
      ativo) + migration. O `AdSlot` do portal hoje é **placeholder estático**;
      passa a receber a campanha de um RSC novo (`AdPlacement`), porque
      `packages/ui` não pode consultar banco.
- [ ] Decidir antes de escrever: **uma campanha por posição ou rodízio?** e
      **segmenta por editoria ou é global?** As duas mudam o modelo, não só a
      tela. Sem resposta, o caminho mais curto é uma campanha ativa por posição,
      escolhida pela mais recente.
- [ ] Métricas de impressão/clique ficam para depois (exigem rota de tracking e
      cuidado com cache).

### Apagar matéria e saídas do rascunho — ✅ ENTREGUE (2026-08-31)

Três decisões de produto que valem estar escritas, porque são as que a redação
vai questionar depois:

1. **O que pode ser apagado.** Tudo, menos o que está NO AR
   (`PUBLICADA`/`ATUALIZADA`). Quem quiser eliminar uma matéria publicada
   **arquiva primeiro** e apaga depois — e essa parada no meio é de propósito:
   é a chance de mudar de ideia antes de destruir um endereço que o Google
   indexou e que circula em conversa de WhatsApp. A regra mora no agregado
   (`Article.markDeleted`), não na tela.

2. **Arquivar deixou de exigir matéria no ar.** Era o que prendia o usuário: o
   rascunho criado por engano, sem corpo e sem editoria, só oferecia "Enviar
   para revisão". Agora arquivar vale de qualquer estado menos do próprio
   arquivo, e a permissão acompanha — tirar do AR continua exigindo
   `article:unpublish` (decisão de quem responde pela editoria), mas guardar o
   próprio rascunho passa por `article:edit-own`, que é parte de escrevê-lo.

3. **A digitação de "APAGAR" NÃO é pedida sempre**, e isso é escolha, não
   esquecimento. Confirmação que aparece em toda ação vira reflexo: a pessoa
   digita sem ler, e a trava deixa de proteger justamente na vez que importava.
   Ela fica reservada a dois casos — quando alguma das matérias **já esteve
   publicada** (o endereço público morre junto) ou quando é **mais de uma de
   uma vez** (o erro de mira do lote não se desfaz). Um rascunho solto que
   nunca saiu do painel confirma com um clique. A palavra aceita minúscula e
   espaço sobrando: o que se compra com ela é deliberação, não acerto de
   grafia.

**A auditoria sobrevive ao apagamento.** O evento `ArticleDeleted` carrega
título, slug e `wasPublished` no corpo, e é gravado na MESMA transação que
remove a linha. Sem isso, apagar uma matéria zeraria o título de toda a
história dela na auditoria — as linhas anteriores virariam um id solto, e um
registro que não diz sobre o que fala não presta contas de nada.

**Falta uma decisão humana:** hoje um redator pode apagar de vez o próprio
rascunho, sem lixeira e sem restauração. Se a redação preferir uma lixeira com
prazo (apagar de verdade só depois de N dias), é outra feature — e é mais fácil
decidir isso antes de alguém perder um texto do que depois.

### Sobrou da spec 05b (configurações)
- [x] ~~**Favicon fixo no código**~~ ✅ Resolvido em 12/08: `faviconMediaId` nas
      Configurações, campo próprio na aba Identidade. Coluna separada do
      `logoMediaId` de propósito — o logo é horizontal e legível a 200px, o
      favicon é quadrado e precisa funcionar a 16px. O arquivo saiu de
      `app/favicon.ico` para `public/brand/favicon.ico`: aquele caminho é
      CONVENÇÃO do Next e é injetado no `<head>` automaticamente, sem o banco
      poder sobrepô-lo — com os dois presentes saíam duas tags `icon` e o
      navegador escolhia. Agora é uma tag só, do `generateMetadata`, com o
      arquivo de `public/` como fallback explícito.
- [x] ~~**SEO e feeds ainda leem do arquivo**~~ ✅ Resolvido em 13/08 pela
      [spec 07](./specs/07-seo-e-indexacao.md) (D1): `lib/seo/site-identity.ts`
      resolve a identidade do veículo a partir do banco e `structured-data.ts`,
      `feed.ts`, `robots.ts`, `sitemap*.xml` e as rotas de RSS a recebem por
      PARÂMETRO — o que também as tornou puras e testáveis sem Postgres.
      `config/site.ts` continua sendo os defaults, mas nenhum gerador de SEO o
      lê direto. A normalização da URL (barra final) tem teste próprio: era o
      caminho para duplicar o site inteiro no índice.
- [ ] **A frase do rodapé** ("Notícias do Piauí 24 horas no ar, em todo lugar")
      segue no código: é copy, e o modelo não tem campo para ela. Criar um custa
      outra migration; entra junto do próximo campo que precisar.
- [x] ~~**Tela de configurações não foi verificada visualmente**~~ ✅ Feito em
      11/08 — ver a seção "Aceite visual", no topo.

### Avulso
- [x] ~~**Grade de programação da rádio**~~ ✅ Resolvido (Bloco 2): novo
      contexto `packages/contexts/broadcast` (agregado `Program`, grade
      semanal recorrente — sem exceção pontual, por decisão do cliente).
      Painel em "Programação" (`broadcast:manage`, ADMIN). O portal
      (`ScheduleList`) lê do banco via `loadSchedule`; "no ar agora" é
      calculado contra o relógio (`isProgramLive`/`Program.isLiveAt`), nunca
      guardado. `LIVE_SHOW`/`TRACK_LOG` (o widget do programa "ao vivo" em
      destaque e o log de músicas) continuam fixture — não fazem parte da
      grade, ficam para quando viram feature própria.
- [x] ~~**Enquete da home**~~ ✅ Resolvida (Bloco 5): novo contexto
      `packages/contexts/polls` (agregado `Poll` com máquina de estados
      `RASCUNHO → PUBLICADA → FECHADA`, sem volta). Voto **anônimo por cookie**
      httpOnly, por decisão do cliente — sem conta de leitor. A garantia de
      "um voto por pessoa" é a chave única `pollId + voterToken` no BANCO, não
      uma checagem antes do insert (só o banco resiste a dois cliques
      simultâneos — há teste de concorrência provando isso). O resultado só
      aparece **depois** do voto, e essa decisão é aplicada no servidor: quem
      não votou nem recebe os números, então não adianta inspecionar o
      elemento. Painel em "Enquetes" (`polls:manage`, ADMIN); publicar uma
      nova encerra a anterior (o portal mostra uma por vez).
      No portal, o card é **RSC** e só o botão de votar é cliente, via Server
      Action — o grupo `(site)` continua sem `QueryClientProvider`.
- [x] ~~**Colunistas e vídeos da home** ainda são fixture~~ ✅ Resolvido dos
      dois lados, em direções opostas (12/08). **Colunista** ganhou contato
      público (redes e e-mail) reusando `beat`/`blurb` como profissão e sobre,
      mais a página `/colunistas` — índice que leva ao `/autor/{slug}` que já
      existia, em vez de uma rota de coluna própria que competiria com ela no
      Google. **Vídeo** foi REMOVIDO: não havia player, página nem cadastro
      atrás daqueles quatro itens. Volta como contexto próprio se voltar.
- [x] ~~**Foto do colunista some fora da home**~~ ✅ Resolvido (12/08). Não era
      upload: a precedência entre `StaffMember` e o cadastro de colunista era
      TUDO-OU-NADA no `getAuthor`, e bastava a pessoa ter conta no painel para
      o registro inteiro ser descartado — inclusive a foto, e mesmo com o
      perfil da Equipe vazio, que é o caso do primeiro admin. Agora a fusão é
      campo a campo. A assinatura da matéria tinha um segundo defeito irmão: o
      quadro hachurado estava fixo no HTML, sem condição, então nunca mostrava
      foto. Virou `AuthorAvatar`, usado nos três lugares.
- [x] ~~**"Mais lidas" não é mais lidas**~~ ✅ Resolvido (Bloco 3): novo
      contexto `packages/contexts/analytics` com `ViewCounterPort` (Redis,
      janela móvel de 24h — sorted set por matéria, não balde que zera à
      meia-noite). `ViewTracker` (client isolado, `sendBeacon`) registra a
      visita na página da matéria via `/api/track/pageview`, sem custar tempo
      de resposta. `getMostRead()` e o filtro "lidas" das listagens
      (`mostReadRank`) agora usam o ranking de verdade; sem Redis disponível
      (cache frio, serviço fora do ar), degradam para as mais recentes (N03)
      em vez de quebrar.
- [x] ~~**Analytics editorial (A38)**~~ ✅ Resolvido (Bloco 4): log DURÁVEL de
      visualização em Postgres (`page_view`) ao lado do contador de 24h em
      Redis — o painel precisa de histórico, que não cabe num cache
      descartável. Tela em "Insights" (`analytics:view`, **ADMIN e EDITOR** —
      é insumo de pauta, não governança como a auditoria). Mostra
      visualizações por dia, origem do tráfego, tempo médio de leitura por
      matéria e volume de produção por autor/editoria.
      **Sem dado pessoal** (N09): nem IP, nem user-agent, nem identificador de
      leitor — o referrer é classificado no servidor e descartado, só a
      categoria é guardada.
      Duas decisões que valem revisão: (a) o tempo de leitura só é reportado a
      partir de **3 segundos** — abaixo disso é clique errado, não leitura, e
      contaria contra a média; (b) a partir da segunda página da mesma aba a
      origem é "interno", porque em navegação client-side o `document.referrer`
      congela no que trouxe o leitor ao site.
- [x] ~~**Faixa de cotações na home**~~ ✅ Entregue em 12/08, a pedido do
      cliente, no espaço que a "TV 7 Cidades" deixou. Dólar, Euro e Bitcoin da
      [AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas), lidos no
      SERVIDOR — no cliente seria uma requisição por visitante, e a API sem
      chave para em 100; daqui, com o `revalidate = 60` do grupo `(site)`, é no
      máximo uma por minuto para o site inteiro, seja qual for a audiência. Por
      isso também dispensa chave. Mesma regra do Inngest, do Redis e do Mailer:
      SaaS é peça trocável. Timeout de 3s porque o caso comum não é a API cair
      e sim FICAR LENTA; falha, timeout, HTTP de erro ou JSON torto degradam
      para lista vazia e a seção some — exercitado trocando o host por um
      inexistente. A leitura do payload é módulo puro com 26 testes
      (`lib/quotes.ts`), porque a API manda todo valor como STRING e
      `Number("")` é 0 — um zero falso na faixa leria como "o dólar vale nada".
- [x] ~~**Temperatura do topo é `"32°C"` fixo**~~ ✅ Resolvido em 12/08 (D12
      encerrada). Vem da [Open-Meteo](https://open-meteo.com/en/docs), sem
      chave, para a cidade CONFIGURADA — não uma coordenada escrita no código:
      se o veículo mudar de praça o cabeçalho acompanha sem deploy, e ninguém
      precisa saber latitude para configurar um portal. A geocodificação é
      cacheada por 30 dias (coordenada de cidade não muda) e a previsão por 15
      minutos, que é o passo de atualização da fonte. Sem leitura, o trecho
      SOME — cidade e estado seguem sozinhos, sem o "·" órfão. **A dívida era
      real e mensurável:** no dia da troca marcava 36 °C, quatro graus acima do
      valor fixo.
      **Pendência de LICENÇA, não de código:** o plano gratuito da Open-Meteo é
      declarado para uso NÃO COMERCIAL, e o portal de uma rádio comercial
      provavelmente não se enquadra. O volume não é o problema (uma requisição
      por minuto para o site inteiro) — é a licença. O cliente precisa decidir
      entre assinar o plano comercial deles ou trocar de provedor; a troca é
      barata, porque só `data/weather.ts` conhece a fonte.
- [ ] **`packages/api` não é verificado**: o `package.json` tem `"scripts": {}`,
      sem `check-types` — o pacote dos routers e das permissões nunca passa pelo
      `tsc` no CI. O que o `apps/web` importa é verificado de carona; o resto,
      não. Ligar pode revelar erros acumulados, então merece commit próprio.
- [x] ~~**Excluir imagem da biblioteca**~~ ✅ Resolvido junto do upgrade da
      biblioteca ([spec 06](./specs/06-biblioteca-de-midia.md)): pastas,
      documentos (PDF/DOC/XLS/CSV/TXT), exclusão e ações em lote sobre uma
      seleção. A checagem de uso que faltava virou a porta `MediaUsage`, com o
      adapter na raiz de composição perguntando ao editorial se a mídia é capa
      **ou** bloco do corpo — e vale para rascunho também.
      Aceite visual feito em 11/08: a recusa da `MediaUsage` foi exercitada na
      tela e devolve a mensagem certa.
- [ ] **Mais recursos de edição no TipTap** — pedido do cliente em 07/08, junto
      da correção da tipografia do editor. O que já entrou naquele commit foi só
      o que **não** custa domínio novo: `Typography` (aspas curvas, travessão,
      reticências) e `CharacterCount` (contagem no rodapé), mais o modo tela
      cheia.

      **O que sobra exige mudar o domínio**, e é por isso que ficou de fora: o
      `StarterKit` desliga `codeBlock`, `code`, `strike`, `underline` e
      `horizontalRule` de propósito — ligá-los sem o resto da cadeia geraria
      conteúdo que o serializador **descarta em silêncio**, e o jornalista
      perderia o que escreveu sem nenhum aviso.

      Cada recurso novo é a mesma cadeia de quatro passos, e nenhum deles é
      opcional:

      1. tipo novo na união `Block` (`packages/contexts/editorial/src/domain/body.ts`)
         e na `BlockInput`, com validação;
      2. ida e volta em `serialize.ts` (`docToBlocks` e `blocksToDoc`);
      3. renderização em `block-renderer.tsx`, que é o que o leitor vê;
      4. tolerância na leitura (`fromRaw` nunca falha — o portal serve conteúdo
         antigo e não pode explodir por formato novo).

      Candidatos, do mais barato ao mais caro: **divisória** (`horizontalRule`,
      bloco sem conteúdo), **destaque/`mark`** e **sublinhado** (marcas inline,
      entram na união `InlineNode`), **âncora com sumário** (precisa de id
      estável por título), **tabela** (o mais caro — bloco aninhado, e ainda
      exige decidir o comportamento no celular).

      **Decisão pendente do cliente:** quais destes a redação realmente usa. Não
      vale construir os cinco para descobrir que ninguém usa tabela.

---

## 🟡 Dívida técnica assumida

| Item | Razão | Risco se ficar |
|---|---|---|
| **Testes do serializador do TipTap** | Bloco A entregue sem testes novos, a pedido | Uma regressão no `docToBlocks` quebra o autosave silenciosamente. **Esqueleto pronto** em `apps/web/tests/unit/serialize.test.ts` (13 `it.todo` + 1 caso de fumaça); falta preencher |
| **Testes de router** para os dois defeitos de autorização corrigidos | idem | Nada impede a regressão voltar. **Esqueleto** em `packages/api/tests/unit/authorization.test.ts` — implementar exige antes tornar a raiz de composição injetável (`createAppRouter(deps)` no lugar dos singletons de módulo em `staff.ts`), senão o teste vira integração |
| **Testes de formatação de data** | idem | `apps/web/tests/unit/format.test.ts` — módulo que já quebrou duas vezes em produção; os dois casos de fumaça cobrem esse par, o resto é `it.todo` |
| **E2E do arquivamento pelo seletor e do envio direto de capa** | Entregue sem E2E (31/08) | A LÓGICA tem teste de verdade — `apps/web/tests/unit/article-selection.test.ts` (quem pode ser marcado, o que "marcar tudo" marca, o texto do aviso final) e os casos de arquivo/lote em `packages/contexts/editorial/tests/unit/manage-articles.test.ts`. Falta a FIAÇÃO: caixinha → barra → diálogo → mutação → lista. **Esqueleto** em `apps/web/tests/e2e/dashboard-articles.spec.ts` (12 `test.fixme`); preencher exige antes uma sessão de staff compartilhada — hoje só `auth.spec.ts` tem uma, porque a vaga de primeiro-ADMIN é de uso único por banco |
| **E2E das colunas congeladas e redimensionáveis** | Entregue sem E2E (31/08) | A aritmética tem teste de verdade (`apps/web/tests/unit/table-columns.test.ts`, 30 casos). Falta o que só o navegador sabe: se a célula gruda ao rolar, se o fundo dela é opaco, e se o arrasto chega ao fim. **Este último já mordeu**: a primeira versão lia estado do React nos handlers de ponteiro e perdia o gesto quando ele era rápido — pego na verificação manual, não por teste. **Esqueleto** em `dashboard-articles.spec.ts` (7 `test.fixme`) |
| **E2E de apagar matéria e das saídas do rascunho** | Entregue sem E2E (31/08) | A parte que DECIDE tem teste real em três camadas: o agregado recusa apagar o que está no ar (`article-workflow.test.ts`), o caso de uso exige `article:unpublish` para o que já esteve publicado e relata o lote parcial (`manage-articles.test.ts`), e a tela sabe quando cobrar a palavra digitada (`article-selection.test.ts`). Falta o que só o navegador prova, e é o mais perigoso desta entrega: que o botão destravado corresponde à palavra digitada, e que some a linha certa — um `onClick` com a mira errada num `DropdownMenuItem` apaga a matéria errada com o CI verde. **Esqueleto** em `dashboard-articles.spec.ts` (12 `test.fixme`) |
| **E2E da publicidade** | Entregue sem E2E (31/08) | A lógica tem 129 testes reais em cinco arquivos (regra de veiculação, agregado, casos de uso, contrato contra Postgres, sorteio no cliente, corpo do beacon e sincronia das listas de posição). Falta o que só o navegador sabe — e **dois defeitos desta entrega só apareceram ali**: o `z.record` com chaves de enum recusando o salvamento do AdSense, e o cliente Prisma não regenerado degradando o portal para "sem anúncio" em silêncio. **Esqueleto** em `apps/web/tests/e2e/ads.spec.ts` (16 `test.fixme`) |
| **`next/image` no painel e no portal** | Falta `images.remotePatterns` para o host do R2 | Imagens servidas sem otimização; pesa no Core Web Vitals. A spec 07 deixou o barato feito (`fetchPriority="high"` na capa, `width`/`height` quando a mídia foi medida), mas a otimização por host segue de fora — é decisão de custo, não de código |
| **Fonte da marca na imagem social (`/og`)** | O `ImageResponse` usa a fonte padrão do Satori, não a Archivo do portal | O cartão do WhatsApp não é tipograficamente igual ao site. Carregar a fonte custa ler o `.ttf` no servidor a cada geração; entra quando alguém reclamar, não antes |
| **Mídia antiga sem `width`/`height`** | A coluna existe no banco, mas asset enviado antes da medição tem `null` | Aquelas matérias saem sem `og:image:width` — a prévia do WhatsApp funciona, só é mais lenta para decidir |
| **Paginação por cursor (P12)** | Read model carrega tudo em memória | Só incomoda com muitas matérias; hoje é aceitável |
| **Invalidação por evento** (Fase 4, Etapa 5) | Feito o mínimo: `revalidate = 60` no portal. Faltam o consumidor do outbox chamando `revalidateTag` e o Redis | Matéria publicada demora até 1 min para entrar no ar, e o portal consulta o banco de tempos em tempos mesmo sem novidade. Antes disto, as páginas eram **congeladas no build** e matéria nova só aparecia com um redeploy |
| **Busca full-text** (Fase 4, Etapa 6) | Não chegou a ser feita | A busca é `includes` em memória — não erra, mas não escala nem tolera erro de digitação |
| **Gate de lint (`biome ci`)** | Scaffold nunca formatado | Estilo diverge entre arquivos |
| **Branch protection no `main`** | Precisa do owner (`Act962`) | Push direto em `main` é possível — foi o que aconteceu na entrega de 2026-08-07 |
| **Editor visual da home (P06)** | Home compõe por recência | Não dá para destacar manualmente uma matéria |
| **`EventBus` síncrono não tem retry** | O Inngest entrou como AGENDADOR; o adapter do despacho de eventos não foi escrito — ver [`adr/0007`](./adr/0007-eventos-e-agendamento-atras-de-portas.md) | Um consumidor que falhe perde a rodada. O evento não some (a linha do outbox fica sem `processedAt`), mas nada tenta de novo sozinho. Agora é barato: o cliente Inngest e a rota `/api/inngest` já existem |
| **O job de e2e do CI não sobe Redis** | O serviço nunca foi adicionado ao `ci.yml` | O e2e roda sempre com "mais lidas" degradado para "mais recentes". O fallback está sendo exercitado por acidente, e o ranking de verdade **não é testado em lugar nenhum** |
| **Actions do CI em Node 20** | `checkout@v4`, `setup-node@v4`, `cache@v4`, `pnpm/action-setup@v4` | O GitHub já depreciou e força para Node 24. Funciona hoje; quebra sem aviso quando a compatibilidade sair |
| **`.env` local escreve no MinIO e lê do R2** | **Troca consciente, não descuido:** a `S3_PUBLIC_URL` aponta para o R2 para que as CAPAS DO SEED apareçam — elas moram lá, e o próprio `seed.mjs` documenta que no MinIO não resolvem. Decisão do cliente (2026-08-10): manter. Produção conferida e correta | O custo é o outro lado: os seis `S3_*` restantes caem no default do `packages/env` (MinIO), então o PUT vai para `localhost:9000/portal-media` e a leitura monta `pub-….r2.dev/<chave>` — **arquivo enviado localmente pelo painel dá 404 ao abrir**, sem erro em lugar nenhum. Quem for testar upload precisa passar os sete para o mesmo bloco do `.env.example`, e aceitar perder as capas do seed. Ver [`setup.md`](./setup.md) §3.2 |

---

## 🟢 Refinamentos de UX (não bloqueiam)

- [x] ~~Ícones no lugar do nome das redes sociais~~ ✅ Feito em 12/08, nos três
      lugares (compartilhar da matéria, perfil do autor, barra do topo), com
      `react-icons/fa6` — família única, porque misturar famílias nunca fecha o
      alinhamento óptico, e o Simple Icons não tem LinkedIn. O rótulo das redes
      do veículo é texto livre digitado nas Configurações, então
      `resolveNetwork` só casa por correspondência EXATA e devolve `null`
      quando não reconhece — aí o texto continua aparecendo. Casar por "contém"
      poria o logo do X em "Siga no X", que pode levar a qualquer lugar.
      Todo ícone é `aria-hidden` com o nome acessível no elemento que o
      envolve: sem isso a troca deixaria os links MUDOS para leitor de tela.
- [x] ~~Animações discretas~~ ✅ Feito em 12/08, **sem biblioteca** — o que
      "discreto" pede cabe em CSS. O que entrou: guarda global de
      `prefers-reduced-motion` (a fundação, e não existia nenhuma no projeto),
      barra do resultado de enquete crescendo por `scaleX` (não por `width`,
      que reflui a cada quadro), transição na borda da navegação — que trocava
      de cor com PISCADA —, elevação de 1px nos cartões de colunista e o
      "certo" do link copiado chegando com `zoom-in`, porque trocar palavra por
      símbolo num aviso arrisca justamente passar despercebido.
- [ ] Aviso de edição concorrente (dois jornalistas na mesma matéria) — precisa
      de versionamento otimista no agregado.
- [ ] Histórico e diff visual de versões.
- [ ] Busca `⌘K` no painel (o componente já existe, falta ligar).
- [x] ~~Arrastar-e-soltar para reordenar editorias~~ ✅ Feito em 11/08 — ver
      "Ajustes de UI no painel", abaixo. Vale para colunistas também.
- [ ] Upload de **vários** arquivos de uma vez (hoje é um por vez).
- [ ] Perfil de autor editável pelo próprio redator (o backend já suporta).

---

## Ajustes de UI no painel — ✅ CONCLUÍDO (2026-08-11)

Rodada pedida pelo cliente depois do aceite visual. Oito itens; o nono (convite
por e-mail da tela de Equipe) ficou de fora por depender do domínio.

**Dois eram defeito, não acabamento:**

| # | Defeito | Causa | Correção |
|---|---|---|---|
| 7 | "A imagem de capa precisa de texto alternativo" **mesmo com a imagem tendo alt-text** — e a matéria não publicava | A `Cover` guarda uma cópia do alt-text, e quem a preenchia era a TELA. O autosave dispara 1s depois do clique, quando o asset recém-escolhido ainda não chegou ao cliente: gravava `""`. Nada mandava salvar de novo, então a pendência era permanente | `resolveCover` no `routers/editorial.ts` lê o alt-text do próprio `MediaAsset`. Quem sabe o alt-text de um arquivo é o arquivo. Efeito colateral bom: corrigir o alt na biblioteca sincroniza a matéria no salvamento seguinte. As matérias já travadas curam sozinhas ao abrir |
| 8 | Não dava para editar metadado de mídia depois de criada | Só existia `register`. Alt-text errado só saía excluindo e subindo de novo — o que quebra toda matéria que já usa o arquivo | `MediaAsset.updateDetails` (mantendo A29: imagem não pode perder o alt-text), `updateAssetDetails`, `media.update` e modo de edição no painel de detalhe. Com teste de domínio e de aplicação |

**O resto era acabamento:**

- **1, 4, 5 — campo de imagem** (`components/media/image-field.tsx`): preview do
  que está escolhido, **envio direto do computador** (arrastar ou clicar, sem
  passar pela Biblioteca) e escolha do acervo. Usado no logo (Configurações) e na
  foto do colunista; a lista de colunistas ganhou miniatura. O arquivo continua
  indo para o acervo — é lá que ele vive —, mas a tarefa não passa mais por
  aquela tela. Crédito e alt-text são pedidos no envio: são invariantes do
  `MediaAsset`, não burocracia de tela.
- **3 — diálogos maiores**: `sm:max-w-sm` → `sm:max-w-lg`, e teto de altura com
  rolagem interna. Sem o teto, diálogo alto crescia para fora da janela **sem
  barra de rolagem** e o botão de salvar ficava inalcançável. O painel de detalhe
  da mídia tinha o mesmo furo.
- **6 — arrastar-e-soltar** (`components/admin/sortable-rows.tsx`, dnd-kit) em
  colunistas e editorias, no lugar das setas. Teclado atendido (espaço levanta,
  setas movem, espaço solta) com anúncio em português. A ordem é aplicada no
  cache antes da resposta — a linha já está sob o dedo no lugar novo.
- **9 — largura em tela cheia**: `68ch` → `88ch`. Descontado o `px-6`, sobrava
  menos texto por linha do que numa folha A4, e a tela cheia dava menos espaço
  útil que a caixa normal em monitor largo.

**"A foto do colunista não aparece" (item 5) tinha DUAS causas**, e só uma era
código. A outra é a troca consciente do `.env` local (linha da dívida técnica,
abaixo): o upload vai para o MinIO e a leitura monta URL do R2, então **todo
arquivo enviado localmente dá 404** — inclusive `logo_armaze_m_carvalho_vermelho.png`,
que está no MinIO agora. O caminho de render foi conferido com um asset do R2 e
funciona. Para testar upload de ponta a ponta, os sete `S3_*` precisam apontar
para o mesmo lugar.

---

## ⚠️ Falha de terceiro não fica em cache — a lição do 429

O 429 das cotações revelou um defeito que o desenvolvimento **não tinha como
mostrar**, porque em dev as APIs respondem:

> **O Next não guarda em cache resposta que falhou.** Com o cache só no
> `fetch`, cada visita reenviava a chamada. Os logs da Vercel mostraram quatro
> tentativas em cinco segundos — a falha se alimentava, porque enquanto a API
> nos limitava, nós a martelávamos.

O caso ruim nem é o 429, que responde rápido. É a API ficar **LENTA**: aí cada
leitor pagaria os 3 segundos do timeout, e o cabeçalho está em TODA página.

**A correção** foi pôr `unstable_cache` por fora do `fetch`, nas cotações e no
tempo: o que fica guardado passa a ser o RESULTADO, inclusive a lista vazia e
o `null`. Medido num build de produção com o host trocado por um inexistente:
**8 visitas, 0 tentativas** (antes era uma por visita).

**A regra, para a próxima integração externa:** cachear só o `fetch` protege o
caminho feliz e deixa o caminho de erro sem proteção nenhuma — que é
exatamente o que mais precisa dela.

---

## Corrigido nesta rodada (12/08), fora do que foi pedido

Dois defeitos que apareceram enquanto se mexia em outra coisa. Ficam
registrados porque os dois têm a mesma forma — **estado que mora de um lado e
espaço que mora do outro** — e é a forma que tende a voltar:

- **Fechar a âncora de anúncio no celular deixava 68px de branco.** O banner
  era `fixed`, logo fora do fluxo, e quem abria espaço para ele era um
  `pb-[68px]` no wrapper do layout. Esse wrapper é Server Component e o estado
  de "fechado" mora no `AnchorAd`, que é cliente: fechar removia o banner e o
  padding ficava. O número mágico ainda estava errado — o banner mede 63px.
  Corrigido virando `sticky bottom-0` dentro da coluna: o espaço passa a ser
  DELE e some junto. Medido antes (68px sobrando) e depois (0).
- **A foto do autor na assinatura da matéria nunca aparecia** — quadro
  hachurado fixo no HTML, sem condição, com o `author.photoUrl` chegando
  preenchido na prop ao lado. Ver a linha do colunista, acima: é o mesmo
  defeito de fundo.

---

## ⚠️ Data e fuso: o defeito que já voltou três vezes

Vale isolar, porque deixou de ser coincidência e o próximo é previsível:

1. **A data do cabeçalho parada em 3 de agosto** e toda matéria como "há 1 min"
   — medidas contra um instante congelado em vez do relógio (detalhado abaixo).
2. **A data de revisão das páginas legais um dia atrasada** (12/08) —
   `2026-08-12` é DATA DE CALENDÁRIO, o JS a parseia como meia-noite UTC, e
   formatá-la em `America/Fortaleza` (UTC−3) devolve 21h do dia anterior.
3. **A hora da cotação, 3 horas errada** (12/08) — a AwesomeAPI manda
   `"2021-04-13 08:57:27"` em UTC−3 e **não diz isso na string**; `new Date`
   cru usa o fuso de quem executa, que na Vercel é UTC.

**A regra que os três violam é a mesma:** toda data que entra ou sai do sistema
precisa do fuso EXPLÍCITO, e o padrão do JavaScript nunca é o que se espera.
Data de calendário formata-se em UTC (não há instante a converter); string de
terceiro carrega o offset da fonte, escrito à mão se preciso.

Nenhum dos três deu erro, aviso ou teste vermelho — os três **mostraram um
número plausível e errado**, que é o modo mais caro de falhar. As correções
estão em `lib/format.ts`, `components/layout/legal-page.tsx` e
`lib/quotes.ts` (esta com teste fixando o offset da fonte).

---

## Corrigido de passagem (achado ao semear)

Três coisas só apareceram quando o portal passou a ter conteúdo real — com as
fixtures antigas nenhuma das três dava sinal. **Todas o mesmo defeito de fundo:**
uma data medida contra um instante congelado (`FIXTURE_NOW`, 3 de agosto) em vez
do relógio. É por isso que a formatação de data agora tem esqueleto de teste.

- **A data do cabeçalho estava parada em 3 de agosto**, em todas as páginas, e o
  ano do rodapé vinha da mesma constante. Corrigido; com ele saíram as últimas
  fixtures (`articles.ts`, `sections.ts`, `authors.ts` — 420 linhas de notícia
  falsa que só seguiam no bundle por causa dessa constante).

- **Toda matéria aparecia como "há 1 min".** O cálculo de tempo relativo media
  contra um instante fixo herdado das fixtures (`FIXTURE_NOW`, 3 de agosto), não
  contra o relógio. Qualquer matéria publicada depois daquela data caía no piso.
- **Nenhuma listagem mostrava a capa.** Home, cartões, listas e "leia também"
  renderizavam o espaço hachurado mesmo quando a matéria tinha foto — só a
  página da matéria usava a capa. Agora há um `ArticleThumb` compartilhado, que
  mostra a foto com o ponto focal e cai no placeholder quando não há.

---

## Ordem sugerida

Os passos de colocar no ar (migrations, R2, seed) estão **feitos** — o portal
está em produção com conteúdo, e as sete pendências vermelhas foram fechadas. O
que resta, na ordem em que rende mais:

1. **Confirmar em produção o que a seção 🔧 lista** — o cadastro das variáveis
   está feito, mas "mais lidas" e agendamento só se provam pelo COMPORTAMENTO
   (uma matéria antiga subindo no ranking; uma agendada saindo sozinha), não
   por deploy verde. Nada aqui é código, e é o que destrava funcionalidade já
   construída.

2. **Ligar o `check-types` do `packages/api`.** Uma linha no `package.json`,
   e passa a verificar justamente os routers e as **permissões** — a parte cujo
   defeito é mais caro. Merece commit próprio porque pode revelar erro
   acumulado.

3. **Preencher os `it.todo`** (serializador do TipTap, autorização dos routers,
   formatação de data). O de autorização exige antes tornar a raiz de
   composição injetável (`createAppRouter(deps)`), senão o teste vira
   integração. **Os de data subiram de prioridade:** o defeito de fuso já
   voltou três vezes (ver a seção própria acima), e é a família que falha
   mostrando um número plausível em vez de quebrar.

4. **Invalidação por evento.** É o único item da lista que o leitor final
   percebe todo dia: matéria publicada demora até 1 min para entrar no ar.

5. **Banners e patrocinadores**, quando houver anunciante. É o maior item que
   sobrou (contexto `advertising` inteiro) e não rende nada até existir
   campanha para veicular — os patrocinadores foram adiados pelo cliente em
   12/08, e o espaço que tinham na home é hoje a faixa de cotações.

**Duas decisões que dependem do cliente, não de engenharia:** se anúncios entram
agora ou quando aparecer o primeiro anunciante; e o que "colunistas" significa —
autor com destaque (barato, o backend já suporta) ou seção editorial própria
(feature nova).

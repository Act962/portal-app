# Pendências — o que falta para o produto ficar completo

> **Atualizado:** 2026-08-12.
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

## 🚨 Precisa de ação humana — desta rodada (2026-08-12)

Quatro coisas que o código não resolve sozinho e que **ficam erradas em
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
   continuam os seis itens com `href: ""` e a string
   "PRINCÍPIOS EDITORIAIS · PRIVACIDADE · TERMOS DE USO", que agora vai
   aparecer DUPLICADA ao lado dos links novos de Privacidade e Termos.
   Conserto: abrir Configurações → Rodapé e limpar. É clique, não deploy.

3. **A licença da Open-Meteo (temperatura do cabeçalho) precisa de decisão.**
   O plano gratuito é declarado para uso NÃO COMERCIAL e o portal é de uma
   rádio comercial. Não é volume — é licença. Ou assina o plano comercial
   deles, ou troca de provedor (INMET e CPTEC/INPE são públicos e brasileiros).
   A troca custa pouco: só `data/weather.ts` conhece a fonte, e o módulo puro
   com os testes continua valendo.

4. **`setup.md` §3.2 e a linha do `.env` na dívida técnica estão invertidos.**
   Eles dizem que a `S3_PUBLIC_URL` local aponta para o R2 (para as capas do
   seed aparecerem). No `.env` desta máquina os sete `S3_*` apontam para o
   MinIO — o oposto. O efeito também inverteu: upload local funciona e abre
   normalmente; quem dá 404 agora são **as capas do seed**, que moram no R2.
   Conferido no navegador: `uploads/…` responde 200, as chaves do seed dão
   `ERR_BLOCKED_BY_ORB`. Alguém precisa decidir qual dos dois é o combinado e
   corrigir o doc — hoje ele manda o próximo desenvolvedor para o lado errado.

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

### Bloco C — Banners e anúncios

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
- [ ] **SEO e feeds ainda leem do arquivo**: `lib/structured-data.ts`,
      `lib/feed.ts`, `robots.ts`, `sitemap*.xml` e as rotas de RSS usam
      `siteConfig.url/name/description/locale`. O `<title>` e o `og:*` da raiz
      já migraram; estes ficaram porque mexem em URL canônica e sitemap, e um
      erro ali some do Google em silêncio — merece verificação própria. Na
      prática só divergem se o cliente trocar nome ou domínio.
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
| **`next/image` no painel e no portal** | Falta `images.remotePatterns` para o host do R2 | Imagens servidas sem otimização; pesa no Core Web Vitals |
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

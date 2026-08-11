# Pendências — o que falta para o produto ficar completo

> **Atualizado:** 2026-08-11.
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
- [ ] **Colunistas e vídeos da home** ainda são fixture. São conteúdo, não
      configuração: colunista provavelmente é autor com destaque; vídeo é
      feature nova.
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
- [ ] **Temperatura do topo é `"32°C"` fixo** (`top-bar.tsx`). **Fica na tela**
      por decisão do cliente (D12) — troca-se por dado real quando houver uma
      porta `Weather` com provedor. Até lá é dívida consciente: valor fixo que
      parece dado ao vivo engana o leitor (32 °C inclusive quando chove).
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

- [ ] Aviso de edição concorrente (dois jornalistas na mesma matéria) — precisa
      de versionamento otimista no agregado.
- [ ] Histórico e diff visual de versões.
- [ ] Busca `⌘K` no painel (o componente já existe, falta ligar).
- [ ] Arrastar-e-soltar para reordenar editorias (hoje é por setas, funcional).
- [ ] Upload de **vários** arquivos de uma vez (hoje é um por vez).
- [ ] Perfil de autor editável pelo próprio redator (o backend já suporta).

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

3. **Preencher os 29 `it.todo`** (13 no serializador do TipTap, 8 na
   autorização, 8 na formatação de data). O de autorização exige antes tornar a
   raiz de composição injetável (`createAppRouter(deps)`), senão o teste vira
   integração.

4. **Invalidação por evento.** É o único item da lista que o leitor final
   percebe todo dia: matéria publicada demora até 1 min para entrar no ar.

5. **Banners**, quando houver anunciante — é o maior item que sobrou (contexto
   `advertising` inteiro), e não rende nada até existir campanha para veicular.

**Duas decisões que dependem do cliente, não de engenharia:** se anúncios entram
agora ou quando aparecer o primeiro anunciante; e o que "colunistas" significa —
autor com destaque (barato, o backend já suporta) ou seção editorial própria
(feature nova).

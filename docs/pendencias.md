# Pendências — o que falta para o produto ficar completo

> **Atualizado:** 2026-08-07.
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

## 🔧 Configuração de produção — não é código

**O maior retorno por esforço do projeto inteiro está aqui.** São variáveis de
ambiente e uma política de bucket; o código correspondente já está escrito,
testado e no ar. Enquanto não forem cadastradas, quatro funcionalidades prontas
não valem nada — e três delas falham **em silêncio**, que é o pior modo de
falhar.

| Variável / ajuste | Sem isso | Onde |
|---|---|---|
| `CRON_SECRET` | A rota do agendamento responde **503** e a matéria marcada para as 6h não sai sozinha | [`deploy.md`](./deploy.md) §3 |
| CORS de `PUT` no bucket R2 | O envio de imagem trava em 0% — o upload vai do navegador **direto** para o R2 | [`deploy.md`](./deploy.md) §2 |
| `REDIS_URL` | "Mais lidas" degrada para "mais recentes" **sem avisar**: a seção continua na tela, com a ordem errada | `packages/env/src/server.ts` |
| `RESEND_API_KEY` | Convite e redefinição de senha ficam no "avise você mesmo" (funciona, mas é manual) — opcional por desenho | `packages/contexts/identity/src/infrastructure/create-mailer.ts` |

---

## 👀 Aceite visual pendente

Cinco telas existem, passam nos testes automatizados e **nunca foram abertas por
um humano**. Testes provam comportamento, não legibilidade: espaçamento, ordem
dos campos, texto de estado vazio e o que a tela comunica quando não há dado
nenhum só aparecem no olho.

- [ ] **Assuntos/Tags** (`/dashboard/taxonomy`) — criar, renomear, apagar; e o
      que a tela diz quando o assunto está em uso por uma matéria.
- [ ] **Programação** (`/dashboard/programacao`) — com a tabela vazia o card do
      portal fica **oculto** (por desenho); vale ver a tela com grade cheia.
- [ ] **Insights** (`/dashboard/insights`) — num banco sem histórico os gráficos
      aparecem zerados. Verificar se o estado vazio comunica "ainda não há dado"
      em vez de parecer defeito.
- [ ] **Enquetes** (`/dashboard/enquetes`) — rascunho → publicar → votar como
      leitor anônimo → conferir que o resultado só aparece depois do voto.
- [ ] **Configurações** (`/dashboard/settings`) — a aba "Rádio" mudou: sobraram
      frequência e faixa, o campo de transmissão saiu junto com o player.

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
| B7 | ~~Agendamento não publicava sozinho~~ | ✅ **Resolvido**: `GET /api/cron/publish-scheduled`, autenticado por `CRON_SECRET`, agendado no `vercel.json` a cada 5 min. Antes, o único gatilho era um clique no painel — matéria marcada para as 6h esperava alguém lembrar. | [`deploy.md`](./deploy.md) §3 |

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
- [ ] Contexto `advertising` com `Campaign` (imagem, link, posição, período,
      ativo) + migration. O `AdSlot` do portal hoje é **placeholder estático**;
      passa a receber a campanha de um RSC novo (`AdPlacement`), porque
      `packages/ui` não pode consultar banco.
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
- [ ] **Tela de configurações não foi verificada visualmente** — ver a seção
      "Aceite visual pendente", no topo, que agora reúne as cinco telas nessa
      situação.

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
- [ ] **Excluir imagem da biblioteca**: o router de mídia só tem
      `requestUpload`, `register`, `library` e `get`. Um envio errado fica lá
      para sempre e a biblioteca só cresce. Precisa apagar no storage **e** na
      linha do banco, e antes disso checar se alguma matéria usa a imagem —
      capa ou bloco do corpo — senão o portal passa a servir imagem quebrada.

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
| **Cron da Vercel ainda ligado junto com o Inngest** | Rede de segurança durante a transição — as tarefas são idempotentes, então os dois disparando não duplicam nada | Enquanto os dois existirem, a periodicidade vive em dois lugares (o `vercel.json` e o `cron` da tarefa) e nada avisa quando divergem. **Apagar o bloco `crons` do `vercel.json`** depois de confirmar o Inngest em produção resolve — ver [`deploy.md`](./deploy.md) §3.1 |
| **`EventBus` síncrono não tem retry** | O Inngest entrou como AGENDADOR; o adapter do despacho de eventos não foi escrito — ver [`adr/0007`](./adr/0007-eventos-e-agendamento-atras-de-portas.md) | Um consumidor que falhe perde a rodada. O evento não some (a linha do outbox fica sem `processedAt`), mas nada tenta de novo sozinho. Agora é barato: o cliente Inngest e a rota `/api/inngest` já existem |
| **O job de e2e do CI não sobe Redis** | O serviço nunca foi adicionado ao `ci.yml` | O e2e roda sempre com "mais lidas" degradado para "mais recentes". O fallback está sendo exercitado por acidente, e o ranking de verdade **não é testado em lugar nenhum** |
| **Actions do CI em Node 20** | `checkout@v4`, `setup-node@v4`, `cache@v4`, `pnpm/action-setup@v4` | O GitHub já depreciou e força para Node 24. Funciona hoje; quebra sem aviso quando a compatibilidade sair |

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

1. **Configuração de produção** (seção 🔧, no topo). Meia hora de painel da
   Vercel e da Cloudflare, e quatro funcionalidades já construídas passam a
   funcionar. Nada aqui é código.

2. **Aceite visual das cinco telas** (seção 👀). Antes de empilhar feature nova:
   se alguma tela precisar de ajuste, é mais barato descobrir agora do que
   depois de construir em cima dela.

3. **Ligar o `check-types` do `packages/api`.** Uma linha no `package.json`,
   e passa a verificar justamente os routers e as **permissões** — a parte cujo
   defeito é mais caro. Merece commit próprio porque pode revelar erro
   acumulado.

4. **Preencher os 29 `it.todo`** (13 no serializador do TipTap, 8 na
   autorização, 8 na formatação de data). O de autorização exige antes tornar a
   raiz de composição injetável (`createAppRouter(deps)`), senão o teste vira
   integração.

5. **Invalidação por evento.** É o único item da lista que o leitor final
   percebe todo dia: matéria publicada demora até 1 min para entrar no ar.

6. **Banners**, quando houver anunciante — é o maior item que sobrou (contexto
   `advertising` inteiro), e não rende nada até existir campanha para veicular.

**Duas decisões que dependem do cliente, não de engenharia:** se anúncios entram
agora ou quando aparecer o primeiro anunciante; e o que "colunistas" significa —
autor com destaque (barato, o backend já suporta) ou seção editorial própria
(feature nova).

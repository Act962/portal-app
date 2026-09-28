# Deploy — servidor, banco, storage e conteúdo inicial

> Guia operacional para colocar e manter o portal no ar. Para o estado do
> desenvolvimento, ver [`pendencias.md`](./pendencias.md).
>
> **Stack de produção:** aplicação numa **VPS com Coolify** (imagem pelo
> `Dockerfile` da raiz), **PostgreSQL 18** e **Redis** como recursos do próprio
> Coolify, mídia no **Cloudflare R2**, agendamento pelo **Inngest**. Domínio:
> `portal.7cidades.com`.
>
> Até setembro de 2026 o portal rodou na Vercel, com o banco no Neon. A imagem
> Docker entrou no PR #24, a cópia do banco seguiu o §6, e o `vercel.json` foi
> removido depois da virada do DNS.

---

## 0. Passo a passo — do zero ao portal no ar

O detalhe de cada passo está nas seções seguintes.

### 1 · Banco e Redis no Coolify

No mesmo projeto e ambiente do app, em *New Resource*:

1. **PostgreSQL**: imagem `postgres:18-alpine`. A versão importa: um dump só
   restaura com garantia num servidor da mesma versão ou mais nova (§6).
   Copie a **Postgres URL (internal)**; ela é a `DATABASE_URL`.
2. **Redis**: copie a URL interna; ela é a `REDIS_URL`.

Deixe o "Make it publicly available" **desligado**. Ligue só pelo tempo de uma
cópia de banco feita de fora (§6), e desligue logo depois.

### 2 · R2 — bucket, token e CORS

1. O bucket já existe e já tem URL pública.
2. Em *Manage R2 API Tokens*, crie um token com permissão de **leitura e
   escrita** nesse bucket. Guarde as duas chaves.
3. Em *Settings → CORS policy* do bucket, cole (trocando pelo seu domínio):

   ```json
   [{ "AllowedOrigins": ["https://SEU-DOMINIO"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["content-type"],
      "MaxAgeSeconds": 3600 }]
   ```

   Sem isso o envio de imagem trava em 0%: o upload vai do navegador direto
   para o R2.

4. **Ligue um domínio próprio no bucket** (*Settings → Custom Domains*, algo como
   `midia.SEU-DOMINIO`) e use ELE em `S3_PUBLIC_URL`, não o `pub-….r2.dev`.

   O `r2.dev` é o *Public Development URL*, e a Cloudflare o documenta como
   **não destinado a produção**: tem limite de taxa variável (devolve `429`
   acima de centenas de requisições por segundo), a banda também pode ser
   estrangulada, e ele **não passa por cache nem por WAF** — os dois só existem
   atrás de domínio próprio.

   Isto pesa mais desde a spec 07: além do leitor com a página aberta, buscam
   essas imagens o **Googlebot-Image** (elas entram no sitemap com a extensão de
   imagem), o fetcher do **WhatsApp/Facebook** (`og:image`), o **Instagram**
   (a publicação social manda a URL da mídia) e os leitores de **RSS**
   (`<enclosure>`). Imagem que responde 429 vira prévia sem foto e matéria fora
   do Google Imagens — sem erro nenhum aparecer no portal.

   Trocar depois é barato: só o prefixo muda, e as capas já gravadas continuam
   válidas, porque o banco guarda a CHAVE do objeto, não a URL.

### 3 · Gere os segredos

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
```

> `CRON_SECRET` **não é necessária** — o agendamento é do Inngest. Ela só volta
> a fazer falta se você trocar de agendador (§3).

### 4 · O app no Coolify

*New Resource → Private Repository (with GitHub App)*, repositório
`portal-app`:

| Campo | Valor |
|---|---|
| Branch | `main` |
| Build Pack | **Dockerfile** |
| Base Directory | `/` (raiz do repositório — **não** `apps/web`) |
| Ports Exposes | `3000` |
| Domains | `https://SEU-DOMINIO` |
| Healthcheck (na UI) | **desligado** — o `HEALTHCHECK` do Dockerfile (`/api/health`) é o que vale; o da UI roda `curl`, que a imagem slim não tem |

Em *Advanced*:

| Opção | Valor | Por quê |
|---|---|---|
| Disable Build Cache | **desmarcado** | é o cache que faz os deploys rápidos (§1) |
| Include Source Commit in Build | **desmarcado** | marcado, o hash do commit vira `ARG` em todo estágio e **todo** deploy reinstala as dependências |
| Inject Build Args to Dockerfile | marcado (escolha atual) | ver abaixo |
| Use Build Secrets (se aparecer) | **desligado** | com ele as variáveis chegam por `--secret`, e os `ARG` do Dockerfile ficam vazios |

**Inject Build Args to Dockerfile.** Marcado, o Coolify reescreve o Dockerfile
antes do build e põe um `ARG` para cada variável de build logo depois de
**cada** `FROM` — inclusive no estágio de dependências —, junto com um
`COOLIFY_BUILD_SECRETS_HASH` calculado sobre todas elas. Consequência: **mudar
qualquer variável, ou o domínio, reinstala as dependências** no deploy
seguinte. Deploy só de código não é afetado. Ficou marcado por escolha: variável
muda pouco depois que o ambiente estabiliza. Desmarcado, o install só refaz com
mudança de `package.json`, lockfile ou schema — e o Coolify continua passando
os valores por `--build-arg`, que os `ARG` do estágio `builder` recebem.

### 5 · Variáveis de ambiente

Em *Environment Variables* (o *Developer view* aceita colar tudo de uma vez).
**Todas marcadas como disponíveis no build** (*Build Variable* / *Available at
Buildtime*) — ver §1 para o porquê.

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Postgres URL (internal) do passo 1 |
| `REDIS_URL` | URL interna do Redis do passo 1 (sem ela, "mais lidas" cai para recência) |
| `BETTER_AUTH_SECRET` | o que saiu do passo 3 |
| `BETTER_AUTH_URL` | `https://SEU-DOMINIO` |
| `CORS_ORIGIN` | `https://SEU-DOMINIO` |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY_ID` | do token do passo 2 |
| `S3_SECRET_ACCESS_KEY` | do token do passo 2 |
| `S3_BUCKET` | nome do bucket |
| `S3_PUBLIC_URL` | o domínio próprio do bucket, **com** `https://` e **sem** barra no fim, ex.: `https://midia.SEU-DOMINIO` |
| `S3_FORCE_PATH_STYLE` | `false` |
| `INNGEST_SIGNING_KEY` | Settings → Keys, no painel do Inngest — ver §3.1 |
| `INNGEST_EVENT_KEY` | idem |
| `AWESOMEAPI_TOKEN` | token da AwesomeAPI (faixa de cotações) |
| `META_APP_ID`, `META_APP_SECRET` | App da Meta — login do botão "Conectar" (spec 08) |
| `META_INSTAGRAM_ACCESS_TOKEN`, `META_INSTAGRAM_USER_ID`, `META_INSTAGRAM_USERNAME`, `META_INSTAGRAM_TOKEN_EXPIRES_AT` | Instagram configurado pelo ambiente (spec 08, §15) |
| `RESEND_API_KEY`, `GOOGLE_SITE_VERIFICATION` | se usados |

**Não** cadastre `DIRECT_URL` (o Postgres do Coolify não tem pooler; o
`prisma.config.ts` cai na `DATABASE_URL`) nem `INNGEST_DEV`.

### 6 · Deploy

No log, confira:

1. O passo `pnpm db:deploy` terminando em "All migrations have been
   successfully applied" (ou "No pending migrations"). Erro de conexão aqui é o
   build sem acesso à rede interna do Postgres.
2. Nenhum "standalone sem o binário" depois do `next build` (§1).
3. O container `healthy`.

### 7 · Conteúdo

- **Portal novo:** rode o seed uma vez (§4).
- **Vindo de outro banco:** copie com `pg_dump`/`pg_restore` (§6) e faça um
  *Redeploy* depois — as páginas pré-renderizadas no build com o banco vazio só
  se corrigiriam na primeira revalidação.

### 8 · Crie a sua conta

Abra `https://SEU-DOMINIO/login` e cadastre-se. **O primeiro usuário do sistema
nasce ADMIN.** Faça isso antes de divulgar o endereço — enquanto o convite não
existe (Bloco B), qualquer pessoa que acesse o `/login` consegue criar conta.

### Integrações que apontam para o domínio

Quando o domínio muda, três lugares fora do Coolify precisam acompanhar:

| Onde | O quê |
|---|---|
| **Inngest** | *sync* da app em `https://SEU-DOMINIO/api/inngest` (§3.1) |
| **R2** | CORS do bucket liberando `PUT` para o domínio (passo 2) |
| **App da Meta** | URI de redirecionamento `…/api/social/meta/callback`, callback de desautorização `…/api/social/meta/deauthorize`, callback de exclusão de dados `…/api/social/meta/data-deletion`, domínio do app e `…/privacidade` (spec 08, §14.3) |

---

## 1. Como a imagem é construída

O `Dockerfile` tem quatro estágios, ordenados do que menos muda para o que mais
muda, para o cache do Docker fazer o trabalho:

| Estágio | O quê | Quando refaz |
|---|---|---|
| `pruner` | `turbo prune web --docker` — recorta o monorepo no que o `web` usa | todo deploy (segundos) |
| `deps` | `pnpm install`, com os binários que se baixam na instalação (Prisma, skia-canvas, ffmpeg, sharp) e o `prisma generate` | quando muda um `package.json`, o `pnpm-lock.yaml` ou o schema do Prisma (e, com o *Inject Build Args* marcado, uma variável — §0 passo 4) |
| `builder` | `pnpm db:deploy` (migração) → `next build` | todo deploy com código novo |
| `runner` | só o `.next/standalone` + estáticos: sem pnpm, sem código-fonte do build, sem devDependencies | — é a imagem que roda |

Dois caches ficam no servidor **entre** deploys (cache mounts do BuildKit): o
store do pnpm — quando o lockfile muda, só o pacote novo baixa — e o
`.next/cache` (imagens otimizadas e fetch cache; a compilação do Turbopack
ainda não é reaproveitada entre builds). A limpeza agendada do Docker no
Coolify (*Servers → Docker Cleanup*), quando roda `docker builder prune`, apaga
os dois: o deploy seguinte é uma build fria.

Medido localmente: build fria **3 min**; deploy só de código **1m30**, com o
`pnpm install` inteiro `CACHED`. O que sobra é o `next build` (≈30 s
compilando, ≈25 s no TypeScript).

**A trava.** Ao fim do build, se o ffmpeg, o `skia.node` ou o `sharp` não
estiverem no standalone, o deploy falha dizendo qual — em vez de a imagem subir
saudável e quebrar na primeira arte ou no primeiro vídeo. A lista do
`next.config.ts` (`serverExternalPackages`, `outputFileTracingIncludes`) é o
que os leva até lá; não remova nenhuma entrada.

**Por que as variáveis precisam estar no build.** O build migra o banco e
pré-renderiza as páginas do portal, e o HTML sai com o prefixo das imagens
(`S3_PUBLIC_URL`), a tag do Search Console etc. O Dockerfile declara um `ARG`
para cada variável que o build lê, só no estágio `builder` — nenhum segredo
vai para a imagem final. **Variável nova que o build precise ler ganha o seu
`ARG`**: com o *Inject Build Args* marcado ela até chegaria sem isso, mas o
build não deve depender dessa opção.

**Fuso.** O container roda em UTC; o código converte para o fuso de São Paulo
explicitamente (`lib/format.ts`, `lib/admin-dates.ts`). Não defina `TZ`.

Se o `next build` morrer sem erro logo depois de "Compiled successfully", é
heap do V8 numa VPS pequena — o nerp-2 resolveu com
`apps/web/scripts/next-build.mjs` (`--max-old-space-size`), chamado pelo script
`build` do app. Só traga se acontecer aqui.

### Testar a imagem localmente

```bash
docker build -t portal-web --build-arg DATABASE_URL="postgresql://…" --build-arg BETTER_AUTH_SECRET="…" --build-arg BETTER_AUTH_URL="http://localhost:3000" --build-arg CORS_ORIGIN="http://localhost:3000" .
```

Use um banco descartável: o build **aplica as migrations** nele. Rodando o
container, os pacotes nativos são resolvidos por `apps/web/.next/node_modules`
(links do Turbopack), não por `apps/web/node_modules`.

---

## 2. Migrations

O comando de produção é:

```bash
pnpm db:deploy
```

`prisma migrate deploy` só aplica as migrations pendentes, em ordem, sem
interação e sem nunca destruir dados. Ele roda no estágio `builder` do
Dockerfile, **antes** do `next build`: se falhar, o deploy para ali e o
container antigo continua no ar.

- É um passo à parte do build de propósito: build cacheado não pode pular
  migração.
- **Nunca rode `db:migrate` contra produção.** É `prisma migrate dev` —
  interativo, para desenvolvimento, e chega a propor apagar dados.

Conferir o que foi aplicado:

```bash
DATABASE_URL="postgresql://…" pnpm --filter @portal-app/db exec prisma migrate status
```

> **Postgres com pooler** (Neon, Supabase): a migração não pode passar pelo
> pooler — em modo transaction ele não sustenta advisory lock nem DDL na mesma
> sessão, e o sintoma é "as tabelas não foram criadas", sem erro claro. Por
> isso o `prisma.config.ts` usa `DIRECT_URL` quando ela existe. No Postgres do
> Coolify não há pooler, e a variável não se cadastra.

---

## 3. Storage de mídia em produção — Cloudflare R2

O adapter `S3MediaStorage` (`packages/contexts/media/src/infrastructure/`) fala
S3 e serve tanto o MinIO local quanto o R2, atrás da porta `MediaStorage`
(ADR 0009). **Não há código a mudar — só configuração** (§0 passos 2 e 5).

| Variável | Valor em produção (R2) |
|---|---|
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY_ID` | *Access Key ID* do token R2 |
| `S3_SECRET_ACCESS_KEY` | *Secret Access Key* do token R2 |
| `S3_BUCKET` | nome do bucket (ex.: `portal-media`) |
| `S3_PUBLIC_URL` | URL pública do bucket — **domínio próprio**, com `https://` e sem barra no fim |
| `S3_FORCE_PATH_STYLE` | **`false`** — o R2 usa *virtual-hosted style* |

> 🔐 **As credenciais não entram no repositório.** Cadastre-as no painel de
> variáveis de ambiente do Coolify. Nada de commit em `.env`, nada de colar em
> chat ou ticket — uma chave que vaza dá escrita no bucket inteiro. Se uma chave
> for exposta, revogue no painel da Cloudflare e gere outra; não adianta só
> apagar a mensagem.

No bucket: **leitura pública** no domínio de `S3_PUBLIC_URL`; **CORS liberando
`PUT`** do domínio do painel (o upload vai do navegador direto para o R2, por
URL pré-assinada — A28); token com **leitura e escrita**.

**Como validar:** suba uma imagem pela Biblioteca de mídia do painel. Se
aparecer na grade e carregar no portal, está certo. Se o envio travar em 0%, é
CORS.

---

## 4. Publicação automática das matérias agendadas

O painel deixa marcar uma matéria para sair às 6h. Quem publica de fato é o
**Inngest** (§4.1), que executa a tarefa `publish-scheduled` a cada 5 minutos.

A tarefa publica tudo que venceu, despacha os eventos (auditoria inclusa) e
devolve `{"published": N, "ids": [...]}`. É idempotente: rodar de novo sem nada
vencido devolve `0`.

**Há ainda um gatilho sempre ativo:** a primeira renderização de página depois
do horário publica as vencidas (`publishDueScheduledOnRead`, em
`apps/web/src/data/read-model.ts`). O agendador cobre o caso do portal sem
visitante — com tráfego, a matéria sai de qualquer jeito.

O botão **"Publicar agendadas vencidas"**, no menu da lista de matérias, é o
disparo manual, útil para testar e para não ficar refém do agendador.

### Trocar de agendador, ou adicionar uma tarefa

Registrar uma tarefa nova é uma linha em `packages/api/src/scheduler.ts`. A
porta `Scheduler` ([ADR 0007](./adr/0007-eventos-e-agendamento-atras-de-portas.md))
deixa trocar o motorista sem tocar em código de negócio:

| Agendador | Como ligar |
|---|---|
| **Inngest** (adotado) | `packages/api/src/inngest.ts` + a rota `/api/inngest`. Ver §4.1 |
| **crontab da VPS** / cron externo | cadastre `CRON_SECRET` e chame `curl -H "Authorization: Bearer $CRON_SECRET" https://SEU-DOMINIO/api/cron/<tarefa>` |
| **`node-cron`** | no boot: `for (const t of scheduler.tasks()) cron.schedule(t.cron, () => scheduler.run(t.name))` |

A rota `/api/cron/[task]` resolve o nome no registro e **recusa** se
`CRON_SECRET` não estiver definida — é um endpoint que muda o estado do portal.

### 4.1 · Inngest — o agendador de produção

Adotado pela facilidade de operação e pelo **retry com backoff**: uma tarefa
que falhe por banco indisponível é reprocessada sozinha, em vez de esperar a
próxima janela.

O adapter percorre `scheduler.tasks()` e cria uma função por tarefa, usando o
`cron` que a própria tarefa declara — **a periodicidade tem uma fonte só**.
Registrar tarefa nova em `packages/api/src/scheduler.ts` basta; ela aparece no
Inngest no deploy seguinte.

**Localmente** (nenhuma conta necessária):

```bash
pnpm dev:inngest
```

Sobe o Dev Server, que descobre a app em `http://localhost:3001/api/inngest`.
Painel em `http://localhost:8288` — dá para ver a função, disparar à mão e ler o
log de cada execução. Exige `INNGEST_DEV=1` no `apps/web/.env`; sem ela o SDK
assume nuvem e a rota responde 500 pedindo chave de assinatura.

**Em produção:**

1. No painel do Inngest, aponte o *sync* da app para
   `https://SEU-DOMINIO/api/inngest`.
2. Em *Settings → Keys*, copie a **Signing Key** e a **Event Key**.
3. Cadastre no Coolify `INNGEST_SIGNING_KEY` e `INNGEST_EVENT_KEY`. **Não**
   defina `INNGEST_DEV`.
4. Faça o deploy e confirme no painel do Inngest que a função
   `publish-scheduled` aparece com o gatilho `*/5 * * * *`.

Chamada à rota sem assinatura responde `401` — é o esperado com a chave
configurada.

### 4.2 · Vídeo: o que o deploy precisa ter (spec 12)

A tarefa `publish-social` monta vídeo desde a spec 12. **O binário do ffmpeg
precisa chegar à imagem.** Ele não vem no pacote npm: o script de instalação do
`ffmpeg-static` o baixa para o sistema em que instala. Quatro lugares cuidam
disso e nenhum pode ser removido:

| Onde | O quê | Se faltar |
|---|---|---|
| `pnpm-workspace.yaml` → `onlyBuiltDependencies` | deixa o script de instalação rodar | o pacote instala VAZIO |
| `next.config.ts` → `serverExternalPackages` | não empacota o módulo | o caminho aponta para dentro do bundle, e dá `ENOENT` |
| `next.config.ts` → `outputFileTracingIncludes` | copia o binário para o standalone | o arquivo não existe em produção |
| `Dockerfile` → trava do `builder` | confere que o binário chegou | o deploy passaria, e o vídeo quebraria só em produção |

É a mesma exigência do `sharp` e do `skia-canvas`, pelo mesmo motivo.

A montagem roda no mesmo servidor que atende o portal, sem teto de tempo de
função (o `maxDuration` existia só para a Vercel). Quem a limita é o
`RENDER_MAX_SECONDS` (90 s de vídeo), no domínio.

Para conferir depois do deploy, sem publicar nada: aprove um post de vídeo e
acompanhe a entrega na fila. "O ffmpeg não está instalado neste ambiente" é o
binário faltando.

---

## 5. Conteúdo inicial (seed)

Para o portal não nascer vazio:

```bash
pnpm db:seed                                  # usa a DATABASE_URL do .env
DATABASE_URL="postgresql://…" pnpm db:seed    # aponta para outro banco
SEED_ARTICLES=40 pnpm db:seed                 # muda o volume (padrão: 24)
```

Cria 5 editorias, 8 assuntos e 24 matérias publicadas, com datas espalhadas para
a home ficar com cara de portal em operação.

- **Determinístico e idempotente**: o faker roda com semente fixa, então os
  mesmos títulos (e slugs) saem sempre, e cada linha é um upsert por slug. Rodar
  duas vezes não duplica.
- **Rodar de novo sobrescreve o conteúdo semeado.** Depois que a redação começar
  a editar, não rode mais.
- Roda com `node` puro (`.mjs` sobre o `pg`), sem `tsx` e sem build — por isso
  funciona apontado para qualquer banco, de qualquer máquina. O Postgres do
  Coolify só é alcançável de fora com o acesso público ligado (§0 passo 1).

**As matérias entram sem imagem de capa** — o seed não sobe arquivo para o
storage. Para completá-las, suba as fotos pela Biblioteca de mídia e defina a
capa em cada matéria.

---

## 6. Copiar o banco (`pg_dump` / `pg_restore`)

Foi como o conteúdo saiu do Neon para o Coolify, e é o mesmo procedimento para
backup manual ou para levar produção a outro servidor.

1. **Versão:** o `pg_dump` precisa ser da mesma versão do servidor de origem ou
   mais nova, e o destino, da mesma versão ou mais nova que a origem. Rodar pelo
   Docker evita instalar cliente: `docker run --rm postgres:18 …`.
2. **Origem com pooler** (Neon): use a conexão **direta**, sem `-pooler`.
3. **Destino no Coolify:** ligue o "Make it publicly available" do Postgres só
   durante a cópia e use a URL pública (IP da VPS + porta pública).

```bash
# dump — formato custom, sem dono nem permissões (os usuários não existem no destino)
docker run --rm -v "$PWD:/out" postgres:18 pg_dump "$ORIGEM" --format=custom --no-owner --no-acl --file=/out/portal.dump

# restore — uma transação só: se algo falhar, nada fica pela metade
docker run --rm -v "$PWD:/out" postgres:18 pg_restore --dbname="$DESTINO" --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error /out/portal.dump
```

- **`--clean --if-exists` apaga as tabelas do destino** antes de recriá-las.
  Confira antes que o destino não tem dado que importe — num Postgres recém
  criado, o primeiro deploy já terá criado as tabelas, vazias.
- O dump leva a `_prisma_migrations`: o deploy seguinte reconhece as migrations
  como aplicadas.
- **Confira** comparando a contagem de linhas por tabela na origem e no destino.
- Depois: *Redeploy* do app (as páginas pré-renderizadas saem com o conteúdo),
  **desligue o acesso público** e apague o arquivo `.dump` — ele tem o banco
  inteiro, sessões incluídas.

O que for publicado na origem depois do dump não vai junto: numa virada, congele
a edição pelos minutos da cópia.

---

## 7. Checklist de um deploy limpo

1. [ ] Postgres 18 e Redis criados no Coolify, sem acesso público.
2. [ ] App com Build Pack **Dockerfile**, Base Directory `/`, porta `3000`,
       healthcheck da UI desligado, "Disable Build Cache" e "Include Source
       Commit in Build" desmarcados.
3. [ ] Variáveis do §0 passo 5 cadastradas e marcadas como disponíveis no
       build. `BETTER_AUTH_SECRET` com no mínimo 32 caracteres, **gerado para
       produção** — nunca o do `.env.example`.
4. [ ] `BETTER_AUTH_URL` e `CORS_ORIGIN` apontando para o domínio real.
5. [ ] No log: migrations aplicadas, nenhuma falta de binário, container
       `healthy`.
6. [ ] CORS do bucket liberando `PUT` do domínio do painel.
7. [ ] `S3_PUBLIC_URL` apontando para o **domínio próprio** do bucket (é o
       prefixo de toda imagem — inclusive do `og:image` e do sitemap de
       imagem). `pub-….r2.dev` em produção é limite de taxa esperando acontecer.
8. [ ] Inngest sincronizado no domínio, `publish-scheduled` com o gatilho
       `*/5 * * * *`, e uma matéria agendada para daqui a poucos minutos
       publicou sozinha. **Não** defina `INNGEST_DEV` em produção.
9. [ ] App da Meta com as URLs de callback no domínio (§0, "Integrações").
10. [ ] Uma arte de padrão gerada e um post de vídeo publicado (binários
       nativos em produção).
11. [ ] Conteúdo: seed (portal novo) ou cópia de banco (§6), seguida de
       *Redeploy*.
12. [ ] Primeiro acesso ao `/login` → criar a conta do dono. **O primeiro
       usuário do sistema nasce ADMIN** (Decisão D2 da Fase 1).

> ⚠️ Enquanto não existir convite (Bloco B da Fase 5), **qualquer pessoa que
> acesse `/login` consegue criar conta** e vira REDATOR automaticamente. Se o
> painel estiver num domínio público antes disso, trate como pendência de
> segurança — está registrada em [`pendencias.md`](./pendencias.md).

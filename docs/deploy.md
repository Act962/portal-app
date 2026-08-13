# Deploy — banco, storage e conteúdo inicial

> Guia operacional para colocar e manter o portal no ar. Para o estado do
> desenvolvimento, ver [`pendencias.md`](./pendencias.md).
>
> **Stack de produção:** aplicação na **Vercel**, banco no **Neon**, mídia no
> **Cloudflare R2**.

---

## 0. Passo a passo — do zero ao portal no ar

Sete passos. O detalhe de cada um está nas seções seguintes.

### 1 · Neon — pegue as DUAS strings de conexão

No painel do Neon, em *Connection string*, copie **duas vezes**:

- com o botão **“Pooled connection” LIGADO** → vai ser a `DATABASE_URL`
- com o botão **DESLIGADO** → vai ser a `DIRECT_URL`

A diferença é o `-pooler` no host. As duas são necessárias: a aplicação usa o
pooler, a migração usa a direta. É o passo que mais dá problema quando pulado.

### 2 · R2 — bucket, token e CORS

1. O bucket já existe e já tem URL pública (`pub-….r2.dev`).
2. Em *Manage R2 API Tokens*, crie um token com permissão de **leitura e
   escrita** nesse bucket. Guarde as duas chaves.
3. Em *Settings → CORS policy* do bucket, cole (trocando pelo seu domínio):

   ```json
   [{ "AllowedOrigins": ["https://SEU-DOMINIO"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["content-type"],
      "MaxAgeSeconds": 3600 }]
   ```

   Sem isso o envio de imagem trava em 0% — o upload vai do navegador direto
   para o R2.

4. **Ligue um domínio próprio no bucket** (*Settings → Custom Domains*, algo como
   `midia.SEU-DOMINIO`) e use ELE em `S3_PUBLIC_URL`, não o `pub-….r2.dev`.

   O `r2.dev` é o *Public Development URL*, e a Cloudflare o documenta como
   **não destinado a produção**: tem limite de taxa variável (devolve `429`
   acima de centenas de requisições por segundo), a banda também pode ser
   estrangulada, e ele **não passa por cache nem por WAF** — os dois só existem
   atrás de domínio próprio.

   Isto pesa mais desde a spec 07: além do leitor com a página aberta, agora
   buscam essas imagens o **Googlebot-Image** (elas entram no sitemap com a
   extensão de imagem), o fetcher do **WhatsApp/Facebook** (`og:image`) e os
   leitores de **RSS** (`<enclosure>`). Imagem que responde 429 vira prévia sem
   foto e matéria fora do Google Imagens — sem erro nenhum aparecer no portal.

   Trocar depois é barato: só o prefixo muda, e as capas já gravadas continuam
   válidas, porque o banco guarda a CHAVE do objeto, não a URL.

### 3 · Gere os segredos

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
```

> `CRON_SECRET` **não é mais necessária** — o agendamento é do Inngest, e o
> `crons` do `vercel.json` foi removido. Ela só volta a fazer falta se você
> trocar de agendador (§3).

### 4 · Vercel — variáveis de ambiente

Em *Settings → Environment Variables*, ambiente **Production**:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string do Neon **com** `-pooler` |
| `DIRECT_URL` | string do Neon **sem** `-pooler` |
| `BETTER_AUTH_SECRET` | o que saiu do passo 3 |
| `BETTER_AUTH_URL` | `https://seu-dominio` |
| `CORS_ORIGIN` | `https://seu-dominio` |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY_ID` | do token do passo 2 |
| `S3_SECRET_ACCESS_KEY` | do token do passo 2 |
| `S3_BUCKET` | nome do bucket |
| `S3_PUBLIC_URL` | o domínio próprio do bucket, ex.: `https://midia.SEU-DOMINIO` (sem barra no fim). Não use o `pub-….r2.dev` — ver §2, passo 4 |
| `S3_FORCE_PATH_STYLE` | `false` |
| `INNGEST_SIGNING_KEY` | Settings → Keys, no painel do Inngest — ver §3.1 |
| `INNGEST_EVENT_KEY` | idem |

Ainda em *Settings*, confira em **General**:

- **Root Directory = a raiz do repositório** (vazio), **não** `apps/web`
- **Build** e **Install Command**: deixe vazios (vêm do `vercel.json`)

### 5 · Deploy

Faça o deploy. O `vercel.json` roda `pnpm db:deploy` antes do build **e as
tabelas são criadas nesse momento**.

Confira no log do build a linha das migrations. Se aparecer erro de conexão, é
quase sempre a `DIRECT_URL` faltando ou apontando para o pooler.

### 6 · Popule o portal (uma vez só)

Da sua máquina, com o repositório atualizado:

```bash
DATABASE_URL="<a string do Neon>" pnpm db:seed
```

Cria 5 editorias, 8 assuntos e 24 matérias publicadas com capa.
**Rode uma vez.** Rodar de novo sobrescreve o conteúdo semeado.

### 7 · Crie a sua conta

Abra `https://seu-dominio/login` e cadastre-se. **O primeiro usuário do sistema
nasce ADMIN.** Faça isso antes de divulgar o endereço — enquanto o convite não
existe (Bloco B), qualquer pessoa que acesse o `/login` consegue criar conta.

---

## 1. Por que as tabelas não foram criadas

**As migrations existem** — são 7, em `packages/db/prisma/migrations/`. O que
faltava era um passo que as **aplicasse** no deploy:

- não há `prisma migrate deploy` em nenhum lugar do processo de publicação (ele
  só aparecia no CI, para o job de e2e);
- `next build` não toca no banco;
- `pnpm db:migrate` é `prisma migrate dev` — **interativo e para
  desenvolvimento**. Ele compara o schema com o banco, pode pedir confirmação e
  chega a propor apagar dados. **Nunca rode `db:migrate` contra produção.**

O comando de produção é outro:

```bash
pnpm db:deploy
```

`prisma migrate deploy` só aplica as migrations pendentes, em ordem, sem
interação e sem nunca destruir dados. É o comando que pode rodar em pipeline.

### Como ligar na Vercel

Já está versionado em **`vercel.json`**, na raiz:

```json
"buildCommand": "if [ \"$VERCEL_ENV\" = \"production\" ]; then pnpm db:deploy; fi && pnpm turbo run build -F web"
```

Duas coisas nesse comando merecem explicação:

- **O `if` não é frescura.** Sem ele, **todo deploy de preview migraria o banco
  de produção** — que é o único banco configurado. Um PR com migração
  incompleta alteraria o schema de produção antes de qualquer revisão. O guarda
  restringe a migração ao ambiente de produção.
- **`pnpm db:deploy`, não `db:migrate`.** `migrate dev` é interativo e pode
  propor apagar dados.

Na configuração do projeto na Vercel:

| Campo | Valor |
|---|---|
| Root Directory | **raiz do repositório** (não `apps/web`) |
| Framework Preset | Next.js |
| Build/Install Command | deixe **vazio** — vêm do `vercel.json` |

> Se o *Root Directory* estiver como `apps/web`, o `vercel.json` da raiz é
> ignorado e a migração não roda. É o erro mais fácil de cometer aqui.

### Neon — a conexão da migração é outra

O Neon entrega **duas** connection strings, e a diferença importa:

| Variável | String | Para quê |
|---|---|---|
| `DATABASE_URL` | a **com `-pooler`** | runtime da aplicação |
| `DIRECT_URL` | a **sem `-pooler`** | migrações (`prisma migrate deploy`) |

O `prisma.config.ts` já usa `DIRECT_URL` quando ela existe. **Cadastre as duas
na Vercel.** Migração através do pooler falha ou trava: o pooler em modo
transaction não sustenta advisory lock nem DDL na mesma sessão — e o sintoma é
justamente "as tabelas não foram criadas", sem erro claro.

O runtime fica no pooler porque a Vercel é serverless: sem ele, cada função
abriria a própria conexão e o limite do Neon estoura rápido.

### Conferir o que foi aplicado

```bash
DIRECT_URL="postgresql://…" pnpm --filter @portal-app/db exec prisma migrate status
```

---

## 2. Storage de mídia em produção — Cloudflare R2

O código **já está pronto para o R2**: o adapter `S3MediaStorage`
(`packages/contexts/media/src/infrastructure/`) fala S3 e serve tanto o MinIO
local quanto o R2, atrás da porta `MediaStorage` (ADR 0009). **Não há código a
mudar — só configuração.**

### Variáveis de ambiente

| Variável | Valor em produção (R2) |
|---|---|
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY_ID` | *Access Key ID* do token R2 |
| `S3_SECRET_ACCESS_KEY` | *Secret Access Key* do token R2 |
| `S3_BUCKET` | nome do bucket (ex.: `portal-media`) |
| `S3_PUBLIC_URL` | URL pública do bucket — **domínio próprio**; o `r2.dev` é só para desenvolvimento (§2, passo 4) |
| `S3_FORCE_PATH_STYLE` | **`false`** — o R2 usa *virtual-hosted style* |

> 🔐 **As credenciais não entram no repositório.** Cadastre-as no painel de
> variáveis de ambiente da hospedagem, onde ficam cifradas. Nada de commit em
> `.env`, nada de colar em chat ou ticket — uma chave que vaza dá escrita no
> bucket inteiro. Se uma chave for exposta, revogue no painel da Cloudflare e
> gere outra; não adianta só apagar a mensagem.

### O que configurar no bucket

1. **Acesso público de leitura** no domínio de `S3_PUBLIC_URL` — o portal serve
   as imagens direto de lá.
2. **CORS liberando `PUT` a partir do domínio do painel.** O upload é feito
   **direto do navegador** para o R2, por URL pré-assinada (A28) — o arquivo
   nunca passa pelo nosso servidor. Sem esse CORS, o envio de imagem falha:

   ```json
   [
     {
       "AllowedOrigins": ["https://SEU-DOMINIO"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

3. O token de API precisa de permissão de **leitura e escrita** no bucket.

### Como validar

Suba uma imagem pela Biblioteca de mídia do painel. Se aparecer na grade e
carregar no portal, está certo. Se o envio travar em 0%, é CORS.

---

## 3. Publicação automática das matérias agendadas

O painel deixa marcar uma matéria para sair às 6h. Quem publica de fato é o
**Inngest** (§3.1), que executa a tarefa `publish-scheduled` a cada 5 minutos.

A tarefa publica tudo que venceu, despacha os eventos (auditoria inclusa) e
devolve `{"published": N, "ids": [...]}`. É idempotente: rodar de novo sem nada
vencido devolve `0`.

**Há ainda um terceiro gatilho, sempre ativo:** a primeira renderização de
página depois do horário publica as vencidas
(`publishDueScheduledOnRead`, em `apps/web/src/data/read-model.ts`). Ou seja, o
agendador cobre o caso do portal sem visitante — com tráfego, a matéria sai de
qualquer jeito.

> **O `crons` do `vercel.json` foi REMOVIDO** (2026-08-07), por decisão: um
> agendador só, uma fonte de periodicidade só, e nada de 503 no log. Com isso
> `CRON_SECRET` deixou de ser necessária em produção — ela só protege a rota
> `/api/cron/[task]`, que ninguém dispara hoje. Ela continua existindo para quem
> quiser trocar de agendador sem mexer em código (ver abaixo).

### Trocar de agendador, ou adicionar uma tarefa

A rota é `/api/cron/[task]`: o último segmento é o **nome** de uma tarefa
registrada em `packages/api/src/scheduler.ts`. Registrar uma tarefa nova é uma
linha lá; a rota, a autenticação e o formato da resposta vêm de graça.

O cron da Vercel é só o motorista de hoje. A porta `Scheduler`
([ADR 0007](./adr/0007-eventos-e-agendamento-atras-de-portas.md)) deixa trocar
sem tocar em código de negócio:

| Agendador | Como ligar |
|---|---|
| **Inngest** (adotado) | já escrito — `packages/api/src/inngest.ts` + a rota `/api/inngest`. Ver §3.1 |
| **Cron da Vercel** | reponha o bloco `crons` no `vercel.json` (uma entrada por tarefa) **e** cadastre `CRON_SECRET` |
| **`node-cron`** / VPS | no boot: `for (const t of scheduler.tasks()) cron.schedule(t.cron, () => scheduler.run(t.name))` |
| **crontab do sistema** | `curl -H "Authorization: Bearer $CRON_SECRET" https://dominio/api/cron/<tarefa>` |

### 3.1 · Inngest — o agendador de produção

Adotado pela facilidade de operação e pelo **retry com backoff**, que o cron da
Vercel não tem: uma tarefa que falhe por banco indisponível é reprocessada
sozinha, em vez de esperar a próxima janela.

O adapter percorre `scheduler.tasks()` e cria uma função por tarefa, usando o
`cron` que a própria tarefa declara — **não há periodicidade redigitada**.
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

1. Crie a app no painel do Inngest e aponte o *sync* para
   `https://SEU-DOMINIO/api/inngest`.
2. Em *Settings → Keys*, copie a **Signing Key** e a **Event Key**.
3. Cadastre na Vercel `INNGEST_SIGNING_KEY` e `INNGEST_EVENT_KEY`. **Não**
   defina `INNGEST_DEV`.
4. Faça o deploy e confirme no painel do Inngest que a função
   `publish-scheduled` aparece com o gatilho `*/5 * * * *`.

> **A periodicidade tem uma fonte só:** o `cron` declarado na tarefa, em
> `packages/api/src/scheduler.ts`. O Inngest lê dali. Isto deixou de ser
> verdade se você repuser o `crons` do `vercel.json` — a Vercel lê o arquivo,
> não o registro, e nada avisa quando os dois divergem.

### Se um dia voltar para o cron da Vercel

O plano **Hobby só aceita cron uma vez por dia** — o deploy recusa o `*/5`. Foi
uma das razões para o Inngest. Se ainda assim quiser voltar, além de repor o
`crons` e a `CRON_SECRET`, ou você aceita um horário só (`"0 9 * * *"`) ou
dirige de fora — cron-job.org, `curl` no crontab de um VPS, `node-cron`. A rota
`/api/cron/[task]` é burra de propósito para isso:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://seu-dominio/api/cron/publish-scheduled
```

O botão **"Publicar agendadas vencidas"**, no menu da lista de matérias,
continua existindo — é o disparo manual, útil para testar e para não ficar
refém do cron.

---

## 4. Conteúdo inicial (seed)

Para o portal não nascer vazio:

```bash
pnpm db:seed                                  # usa a DATABASE_URL do .env
DATABASE_URL="postgresql://…" pnpm db:seed    # aponta para produção
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
  funciona apontado para qualquer banco, de qualquer máquina.

**As matérias entram sem imagem de capa** — o seed não sobe arquivo para o
storage. No portal elas aparecem com o espaço da imagem reservado (sem quebra de
layout). Para completá-las, suba as fotos pela Biblioteca de mídia e defina a
capa em cada matéria.

---

## 5. Checklist de um deploy limpo

1. [ ] Variáveis cadastradas na Vercel: `DATABASE_URL` (**com** `-pooler`),
       `DIRECT_URL` (**sem** `-pooler`), `BETTER_AUTH_SECRET`,
       `BETTER_AUTH_URL`, `CORS_ORIGIN`, `S3_*`, `REDIS_URL`.
2. [ ] `BETTER_AUTH_SECRET` com no mínimo 32 caracteres, **gerado para produção**
       (`openssl rand -base64 32`) — nunca o do `.env.example`.
3. [ ] `BETTER_AUTH_URL` e `CORS_ORIGIN` apontando para o domínio real.
4. [ ] *Root Directory* do projeto na Vercel = **raiz do repositório**.
5. [ ] `prisma migrate status` sem migrations pendentes.
6. [ ] CORS do bucket liberando `PUT` do domínio do painel.
7. [ ] `S3_PUBLIC_URL` apontando para o **domínio próprio** do bucket (é o
       prefixo de toda imagem — inclusive do `og:image` e do sitemap de
       imagem). `pub-….r2.dev` em produção é limite de taxa esperando acontecer.
8. [ ] Uma matéria agendada para daqui a poucos minutos publicou sozinha —
       é o teste de que o Inngest está de fato dirigindo.
9. [ ] `INNGEST_SIGNING_KEY` e `INNGEST_EVENT_KEY` cadastradas, e a app
       sincronizada no painel do Inngest — confira que `publish-scheduled`
       aparece lá com o gatilho `*/5 * * * *`. **Não** defina `INNGEST_DEV`
       em produção.
10. [ ] Seed rodado uma vez (se o portal estiver vazio).
11. [ ] Primeiro acesso ao `/login` → criar a conta do dono. **O primeiro usuário
       do sistema nasce ADMIN** (Decisão D2 da Fase 1).

> ⚠️ Enquanto não existir convite (Bloco B da Fase 5), **qualquer pessoa que
> acesse `/login` consegue criar conta** e vira REDATOR automaticamente. Se o
> painel estiver num domínio público antes disso, trate como pendência de
> segurança — está registrada em [`pendencias.md`](./pendencias.md).

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

### 3 · Gere os segredos

Dois, um para cada finalidade — não reaproveite o mesmo valor:

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 24   # CRON_SECRET
```

### 4 · Vercel — variáveis de ambiente

Em *Settings → Environment Variables*, ambiente **Production**:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string do Neon **com** `-pooler` |
| `DIRECT_URL` | string do Neon **sem** `-pooler` |
| `BETTER_AUTH_SECRET` | o que saiu do passo 3 |
| `BETTER_AUTH_URL` | `https://seu-dominio` |
| `CORS_ORIGIN` | `https://seu-dominio` |
| `CRON_SECRET` | outro segredo gerado (mín. 16 caracteres) — ver §3 |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY_ID` | do token do passo 2 |
| `S3_SECRET_ACCESS_KEY` | do token do passo 2 |
| `S3_BUCKET` | nome do bucket |
| `S3_PUBLIC_URL` | `https://pub-….r2.dev` (sem barra no fim) |
| `S3_FORCE_PATH_STYLE` | `false` |

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
| `S3_PUBLIC_URL` | URL pública do bucket (domínio próprio ou `r2.dev`) |
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

O painel deixa marcar uma matéria para sair às 6h. Quem efetivamente publica é
um **gatilho externo** batendo nesta rota:

```
GET /api/cron/publish-scheduled
Authorization: Bearer $CRON_SECRET
```

Ela publica tudo que venceu, despacha os eventos (auditoria inclusa) e responde
`{"published": N, "ids": [...]}`. É idempotente: chamar de novo sem nada vencido
devolve `0`.

O agendamento já está versionado no `vercel.json` — a cada 5 minutos:

```json
"crons": [{ "path": "/api/cron/publish-scheduled", "schedule": "*/5 * * * *" }]
```

> ⚠️ **Cadastre `CRON_SECRET` na Vercel.** Sem a variável a rota responde **503 e
> não publica nada** — de propósito: um endpoint que muda o portal não pode ficar
> aberto na internet. Com a variável cadastrada, a Vercel manda o header sozinha.

### Se o plano for Hobby

O plano Hobby da Vercel **só aceita cron uma vez por dia** — o deploy recusa o
`*/5`. Duas saídas:

- trocar o schedule por algo diário (`"0 9 * * *"`), aceitando que agendar só
  funciona naquele horário; ou
- **dirigir de fora**: qualquer agendador que faça um GET com o header serve —
  cron-job.org, um `curl` no crontab de um VPS, um `node-cron`. A rota foi feita
  burra exatamente para isso, e essa saída não amarra o produto à Vercel.

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
       `BETTER_AUTH_URL`, `CORS_ORIGIN`, `CRON_SECRET`, `S3_*`.
2. [ ] `BETTER_AUTH_SECRET` com no mínimo 32 caracteres, **gerado para produção**
       (`openssl rand -base64 32`) — nunca o do `.env.example`.
3. [ ] `BETTER_AUTH_URL` e `CORS_ORIGIN` apontando para o domínio real.
4. [ ] *Root Directory* do projeto na Vercel = **raiz do repositório**.
5. [ ] `prisma migrate status` sem migrations pendentes.
6. [ ] CORS do bucket liberando `PUT` do domínio do painel.
7. [ ] `S3_PUBLIC_URL` apontando para o bucket (é o prefixo das imagens).
8. [ ] `CRON_SECRET` cadastrada — confira chamando a rota do §3 à mão: tem de
       responder `{"published":0,...}`, e **não** `503`.
9. [ ] Seed rodado uma vez (se o portal estiver vazio).
10. [ ] Primeiro acesso ao `/login` → criar a conta do dono. **O primeiro usuário
       do sistema nasce ADMIN** (Decisão D2 da Fase 1).

> ⚠️ Enquanto não existir convite (Bloco B da Fase 5), **qualquer pessoa que
> acesse `/login` consegue criar conta** e vira REDATOR automaticamente. Se o
> painel estiver num domínio público antes disso, trate como pendência de
> segurança — está registrada em [`pendencias.md`](./pendencias.md).

# Deploy — banco, storage e conteúdo inicial

> Guia operacional para colocar e manter o portal no ar. Para o estado do
> desenvolvimento, ver [`pendencias.md`](./pendencias.md).

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

### Como ligar no deploy

O passo precisa acontecer **depois do install e antes (ou no lugar) do build**,
com a `DATABASE_URL` de produção no ambiente:

```bash
pnpm install --frozen-lockfile
pnpm db:deploy          # cria/atualiza as tabelas
pnpm build
```

Na **Vercel**, isso vira o *Build Command* do projeto:

```
pnpm db:deploy && pnpm turbo run build -F web
```

Em **Docker/VPS**, é um passo do `entrypoint` ou do job de release, antes de
subir a aplicação nova.

> ⚠️ **Verifique o alvo antes de copiar.** O repositório não tem `vercel.json`
> nem pipeline de deploy versionado — a Decisão 4b (provedor de produção) nunca
> foi fechada (ver `stack.md`). O comando acima assume a raiz do monorepo como
> *Root Directory*. Se o projeto na hospedagem aponta para `apps/web`, o caminho
> relativo muda.

### Conferir o que foi aplicado

```bash
pnpm --filter @portal-app/db exec prisma migrate status
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

## 3. Conteúdo inicial (seed)

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

## 4. Checklist de um deploy limpo

1. [ ] Variáveis de ambiente cadastradas na hospedagem
       (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`,
       `S3_*`).
2. [ ] `BETTER_AUTH_SECRET` com no mínimo 32 caracteres, **gerado para produção**
       (`openssl rand -base64 32`) — nunca o do `.env.example`.
3. [ ] `BETTER_AUTH_URL` e `CORS_ORIGIN` apontando para o domínio real.
4. [ ] Build command roda `pnpm db:deploy` antes do build.
5. [ ] `prisma migrate status` sem migrations pendentes.
6. [ ] CORS do bucket liberando `PUT` do domínio do painel.
7. [ ] Seed rodado uma vez (se o portal estiver vazio).
8. [ ] Primeiro acesso ao `/login` → criar a conta do dono. **O primeiro usuário
       do sistema nasce ADMIN** (Decisão D2 da Fase 1).

> ⚠️ Enquanto não existir convite (Bloco B da Fase 5), **qualquer pessoa que
> acesse `/login` consegue criar conta** e vira REDATOR automaticamente. Se o
> painel estiver num domínio público antes disso, trate como pendência de
> segurança — está registrada em [`pendencias.md`](./pendencias.md).

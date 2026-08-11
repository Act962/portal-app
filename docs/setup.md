# Setup — subir o projeto numa máquina nova

Do zero ao portal rodando. Siga na ordem; cada passo depende do anterior.

Para **colocar em produção**, o documento é outro: [`deploy.md`](./deploy.md).

---

## 1. O que precisa estar instalado

| Ferramenta | Versão | Por quê |
|---|---|---|
| **Node.js** | 22 | É a versão que o CI usa (`.github/actions/setup`); 20.9+ funciona, mas divergir do CI é procurar surpresa |
| **pnpm** | `10.24.0` | Fixado em `packageManager`; outra versão resolve o lockfile diferente |
| **Docker** | qualquer recente | Postgres, Redis e MinIO sobem em container |
| **Git** | — | — |

O jeito curto de acertar o pnpm sem instalar nada global:

```bash
corepack enable && corepack prepare pnpm@10.24.0 --activate
```

O Docker precisa estar **rodando**, não só instalado — no Windows, o Docker
Desktop aberto. Sem ele o passo 4 falha com "cannot connect to the Docker
daemon".

---

## 2. Clonar

```bash
git clone https://github.com/Act962/portal-app.git && cd portal-app
```

---

## 3. Variáveis de ambiente — **antes** de instalar

```bash
cp apps/web/.env.example apps/web/.env
```

A ordem importa: o `pnpm install` dispara `prisma generate` no postinstall, e a
configuração do Prisma lê a `DATABASE_URL` do `.env`. Copiar depois é convidar um
erro no meio da instalação.

O `.env.example` já vem com o ambiente local inteiro preenchido. **Duas coisas
você precisa decidir**, e as duas estão explicadas lá dentro:

### 3.1 `BETTER_AUTH_SECRET`

Não pode ficar com o valor de exemplo. Gere um:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### 3.2 O bloco de storage (`S3_*`) — os sete valores vêm juntos

Existem dois blocos no `.env.example`: um do **MinIO local** e um do **R2**. A
regra que evita a armadilha: **não misture os dois.** O `S3_PUBLIC_URL` é o
endereço de LEITURA e o resto define onde a ESCRITA acontece; se apontarem para
lugares diferentes, o upload funciona, não dá erro nenhum, e o arquivo dá 404
quando alguém tenta abrir.

| Escolha | O que ganha | O que perde |
|---|---|---|
| **MinIO** (bloco padrão) | Tudo offline, upload local funciona de ponta a ponta | As capas do seed não aparecem — elas moram no bucket do R2 (ver 5.1) |
| **R2** | As capas do seed aparecem | Precisa das credenciais do R2, e o que você subir testando vai para o bucket real |

Se for só desenvolver, fique no **MinIO**. As capas ausentes não quebram nada: o
portal reserva o espaço da imagem e segue.

> **Foi assim que a máquina antiga ficou:** `S3_PUBLIC_URL` do R2 e o resto no
> MinIO — de propósito, para ver as capas do seed. Só saiba o efeito colateral:
> arquivo enviado pelo painel some ao abrir.

---

## 4. Instalar e subir os serviços

```bash
pnpm install && pnpm db:start
```

O install termina com um aviso de **"Ignored build scripts"** (`sharp`,
`prisma`, `msw` e outros). É o pnpm 10 bloqueando script de dependência por
padrão, e **pode ignorar**: nada aqui depende deles — o Prisma 7 não tem engine
nativa, e o Next traz o seu próprio `sharp`. Não rode `pnpm approve-builds`
achando que é obrigatório.

Sobe três containers: **Postgres** (5432), **Redis** (6379) e **MinIO** (9000,
console em 9001). O bucket `portal-media` é criado sozinho e já sai com leitura
pública.

**Se alguma porta estiver ocupada** — o caso mais comum é já ter um Postgres na
5432:

```bash
cp packages/db/.env.example packages/db/.env
```

Ajuste `POSTGRES_PORT` ali **e** a `DATABASE_URL` em `apps/web/.env` para a mesma
porta. Os dois têm de bater; mudar só um é o erro clássico.

---

## 5. Criar o schema

```bash
pnpm db:migrate
```

Aplica as migrations versionadas. **Nunca use `db:push`** para isso — ele grava
direto no banco sem gerar migration, e a mudança fica invisível para todo mundo.

### 5.1 Conteúdo inicial (opcional)

```bash
pnpm db:seed
```

Cria 24 matérias, editorias, tags e autores para o portal não nascer vazio. É
determinístico e idempotente (upsert por slug) — rodar duas vezes não duplica.

**Não rode depois que a redação começar a editar:** ele sobrescreve o que
semeou.

As capas do seed apontam para imagens que já existem no bucket do R2. Com o
`S3_PUBLIC_URL` do MinIO elas não resolvem, e o portal mostra o espaço reservado
sem quebrar — é esperado, não é bug.

---

## 6. Rodar

```bash
pnpm dev
```

- Portal: <http://localhost:3001>
- Painel: <http://localhost:3001/dashboard>
- MinIO (ver os arquivos): <http://localhost:9001> — `minioadmin` / `minioadmin`

### 6.1 A primeira conta

Cadastre-se normalmente em <http://localhost:3001/login>. **O primeiro usuário do
banco nasce ADMIN** — é a exceção que existe justamente para haver alguém que
convide os outros. Do segundo em diante, só entra quem tiver convite com aquele
e-mail (o `databaseHooks` do Better Auth recusa o resto).

Ou seja: se você errar o e-mail do primeiro cadastro, o jeito mais rápido é
apagar a linha em `user` e cadastrar de novo.

### 6.2 Agendador (só se for mexer em publicação agendada)

```bash
pnpm dev:inngest
```

O `INNGEST_DEV=1` já vem no `.env.example` — só não o apague, porque ele **não**
é inferido do `NODE_ENV`. Em produção a variável não existe.

---

## 7. Conferir que está tudo de pé

```bash
pnpm check-types && pnpm test:unit
```

Se os dois passarem, o ambiente está correto. Os demais comandos:

| Comando | O que faz |
|---|---|
| `pnpm test` | Unidade + integração (integração sobe Postgres via Testcontainers) |
| `pnpm test:e2e:local` | Playwright contra um banco descartável — **pare o dev server antes** |
| `pnpm check` | Biome, corrigindo o que dá |
| `pnpm depcruise` | Regras de arquitetura (ciclos, isolamento de contexto) |
| `pnpm db:studio` | Prisma Studio |
| `pnpm db:stop` / `db:down` | Para / derruba os containers |

`test:e2e:local` **se recusa a rodar** com um dev server já na 3001. Não é
frescura: o `playwright.config.ts` reusaria o servidor existente com o env
antigo, e a suíte escreveria no seu banco de desenvolvimento.

---

## 8. Quando algo não sobe

| Sintoma | Causa quase sempre |
|---|---|
| `Cannot read properties of undefined (reading 'findMany')` | Cliente do Prisma velho depois de uma migration. `pnpm db:generate` e **reinicie o dev server** |
| Upload funciona mas o arquivo dá 404 ao abrir | Bloco `S3_*` misturado (ver 3.2) |
| `ECONNREFUSED` na porta do Postgres | Container não subiu, ou `POSTGRES_PORT` e `DATABASE_URL` divergem |
| Estilo quebrado / erro estranho no Turbopack | Cache: pare o dev server, apague `apps/web/.next`, suba de novo. Apagar com o servidor rodando corrompe |
| `pnpm install` reclama de versão | `corepack prepare pnpm@10.24.0 --activate` |

---

## Para onde ir depois

- [`../CLAUDE.md`](../CLAUDE.md) — comandos e arquitetura, em resumo
- [`architecture.md`](./architecture.md) — camadas, contextos e as regras que o `depcruise` aplica
- [`roadmap.md`](./roadmap.md) — em que fase o projeto está
- [`pendencias.md`](./pendencias.md) — o que falta, com o porquê de cada dívida
- [`deploy.md`](./deploy.md) — produção

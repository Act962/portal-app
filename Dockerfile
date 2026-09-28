# syntax=docker/dockerfile:1.7
#
# Imagem de produção do portal (Coolify, numa VPS) — ver docs/deploy.md §1.
#
# Quatro estágios, ordenados do que MENOS muda para o que MAIS muda, para o
# cache do Docker fazer o trabalho:
#
#   pruner  → recorta o monorepo no que o `web` usa (`turbo prune --docker`)
#   deps    → instala as dependências. Só depende dos package.json e do
#             lockfile: um deploy que só mexe em código REAPROVEITA esta camada
#             inteira, sem baixar nem instalar nada.
#   builder → gera o client do Prisma, migra o banco e roda o `next build`
#   runner  → só o `.next/standalone` + estáticos, sem pnpm, sem código-fonte,
#             sem devDependencies. É a única camada que vai para produção.
#
# Dois caches persistem ENTRE deploys, no servidor que constrói (cache mounts
# do BuildKit): o store do pnpm (quando o lockfile muda, só o que é novo baixa)
# e o `.next/cache` (imagens otimizadas e fetch cache; a compilação do
# Turbopack em si ainda não é reaproveitada entre builds).
#
# Medido localmente: build fria 3 min; deploy só de código 1m30, com o
# `pnpm install` inteiro CACHED — o que sobra é o `next build`.
#
# Debian (glibc), não Alpine: os binários nativos — skia-canvas, sharp
# (libvips), o ffmpeg — são pré-compilados para glibc.

ARG NODE_VERSION=22

# ─── base ────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
	PATH=/pnpm:$PATH \
	COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
	NEXT_TELEMETRY_DISABLED=1 \
	TURBO_TELEMETRY_DISABLED=1
# O pnpm vem do `packageManager` do package.json da raiz, via corepack.
RUN corepack enable
WORKDIR /app

# ─── pruner ──────────────────────────────────────────────────────────────────
FROM base AS pruner
COPY . .
# A versão do turbo é a do package.json da raiz — sem número redigitado aqui.
RUN pnpm dlx "turbo@$(node -p "require('./package.json').devDependencies.turbo")" \
	prune web --docker

# ─── deps ────────────────────────────────────────────────────────────────────
FROM base AS deps
# openssl: o schema-engine do Prisma (usado pelo `migrate deploy`) linka a libssl.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates openssl \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=pruner /app/out/json/ .
# O `postinstall` do `@portal-app/db` roda o `prisma generate`, que precisa do
# schema — por isso ele entra nesta camada, e mudar o schema reinstala (com o
# store quente, só os binários baixam de novo). Não dá para contornar com
# `--ignore-scripts` + `pnpm rebuild`: testado, o `rebuild` do pnpm 10 sai com
# código 0 SEM rodar nada, e a imagem saía sem o ffmpeg e sem o `.node` do
# skia-canvas — que esses pacotes BAIXAM no script de instalação.
COPY packages/db/prisma.config.ts ./packages/db/
COPY packages/db/prisma/schema ./packages/db/prisma/schema
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
	pnpm config set store-dir /pnpm/store \
	&& pnpm install --frozen-lockfile

# ─── builder ─────────────────────────────────────────────────────────────────
FROM deps AS builder
# O client do Prisma já saiu do `postinstall` na camada `deps` (e fica: a pasta
# gerada está no .dockerignore, então esta cópia não passa por cima dela).
COPY --from=pruner /app/out/full/ .

# As variáveis que o build lê. O Coolify passa as variáveis do app como
# `--build-arg`, mas só as DECLARADAS aqui chegam ao `RUN`. Elas ficam SÓ neste
# estágio: o `runner` não herda ARG, então nenhum segredo vai para a imagem
# final.
#
# Por que o build precisa delas: as páginas do portal são pré-renderizadas
# (ISR), e o HTML sai com o prefixo das imagens (`S3_PUBLIC_URL`), a tag do
# Search Console etc. Faltando uma, a página sai do build errada e só se
# corrige na primeira revalidação.
ARG DATABASE_URL
ARG DIRECT_URL
ARG BETTER_AUTH_SECRET
ARG BETTER_AUTH_URL
ARG CORS_ORIGIN
ARG S3_ENDPOINT
ARG S3_REGION
ARG S3_ACCESS_KEY_ID
ARG S3_SECRET_ACCESS_KEY
ARG S3_BUCKET
ARG S3_PUBLIC_URL
ARG S3_FORCE_PATH_STYLE
ARG REDIS_URL
ARG AWESOMEAPI_TOKEN
ARG GOOGLE_SITE_VERIFICATION
ARG MAIL_FROM
ARG META_APP_ID
ARG META_GRAPH_VERSION
ARG INNGEST_SIGNING_KEY
ARG INNGEST_EVENT_KEY

# A migração vem ANTES do build, como era na Vercel: se ela falhar, o deploy
# para aqui e o container antigo continua no ar. É `migrate deploy` — não
# interativo, nunca destrói dado. Sem banco alcançável o build em si passaria
# (a leitura degrada para vazio, `safely` em data/read-model.ts), mas a
# migração não: esse é o erro que avisa.
RUN pnpm db:deploy

RUN --mount=type=cache,id=next-cache,target=/app/apps/web/.next/cache \
	pnpm --filter web build

# Trava de segurança: os binários nativos só chegam ao standalone se o script
# de instalação os baixou E o rastreador os levou (`next.config.ts`). Faltando
# um, a imagem sobe saudável e quebra só na primeira arte ou no primeiro vídeo —
# em produção. Melhor o deploy falhar aqui, dizendo qual.
RUN cd apps/web/.next/standalone \
	&& for bin in "*ffmpeg-static/ffmpeg" "*skia-canvas/lib/skia.node" "*sharp-linux-x64/lib/sharp-linux-x64.node"; do \
		find . -path "$bin" -type f | grep -q . || { echo "standalone sem o binário: $bin"; exit 1; }; \
	done

# ─── runner ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PORT=3000 \
	HOSTNAME=0.0.0.0
# Sem TZ de propósito: a Vercel roda em UTC e o código converte para o fuso de
# São Paulo explicitamente (lib/format.ts, lib/admin-dates.ts) — mudar o fuso
# do processo seria mudar um comportamento que já está provado em produção.
WORKDIR /app

# O standalone replica o layout do monorepo: o servidor fica em apps/web/.
# Dono `node` porque o ISR grava em `.next/cache` em tempo de execução.
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

# Sem curl/wget na imagem slim: o próprio Node faz a pergunta.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "apps/web/server.js"]

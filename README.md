# portal-app

Portal de notícias da **Rádio 7 Cidades**. Monorepo Turborepo/pnpm: Next.js
(App Router) + tRPC + Prisma/PostgreSQL, com DDD em contextos delimitados.

Nasceu de um scaffold [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack)
e divergiu bastante dele — o banco virou PostgreSQL (ADR 0002) e o domínio
ganhou contextos próprios em `packages/contexts/`.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19 com React Compiler |
| API | tRPC, tipada ponta a ponta |
| Banco | PostgreSQL 17 via Prisma 7 (driver adapter, sem Rust) |
| Auth | Better-Auth (e-mail/senha) |
| Mídia | R2 em produção, MinIO no dev — mesmo adapter S3 |
| Agendamento | Inngest, atrás da porta `Scheduler` |
| UI | shadcn/ui em `packages/ui`, Tailwind v4 |
| Qualidade | Biome, Vitest (unidade + integração), Playwright, dependency-cruiser |

## Como rodar

O guia completo — pré-requisitos, containers, `.env`, primeiro acesso e o que
fazer quando algo não sobe — está em **[`docs/setup.md`](docs/setup.md)**.

O caminho curto, numa máquina que já tem Node 22, pnpm 10.24.0 e Docker:

```bash
cp apps/web/.env.example apps/web/.env && pnpm install && pnpm db:start && pnpm db:migrate && pnpm dev
```

O `.env` vem antes do `install` de propósito: o postinstall roda
`prisma generate`, que lê a `DATABASE_URL`.

Portal em <http://localhost:3001>, painel em `/dashboard`. O **primeiro usuário
cadastrado nasce ADMIN**.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@portal-app/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Git Hooks and Formatting

- Run checks: `pnpm run check`

## Estrutura

```
portal-app/
├── apps/web/                 # A única app: portal público + painel + rota tRPC
├── packages/
│   ├── contexts/             # Domínio, por contexto delimitado
│   │   ├── editorial/        #   matérias (core domain)
│   │   ├── taxonomy/         #   editorias e tags
│   │   ├── media/            #   biblioteca de arquivos
│   │   ├── identity/         #   equipe, papéis e convites
│   │   ├── broadcast/        #   grade de programação
│   │   ├── polls/            #   enquetes
│   │   ├── analytics/        #   audiência
│   │   └── settings/         #   configuração do veículo
│   ├── shared-kernel/        # Result, Entity, portas Clock/IdGenerator — zero dep externa
│   ├── api/                  # Routers tRPC e raízes de composição
│   ├── auth/ db/ env/        # Better-Auth · Prisma · env tipado
│   ├── ui/                   # shadcn/ui compartilhado
│   └── config/               # tsconfig base
└── docs/                     # Specs, ADRs, roadmap — a fonte da verdade
```

Cada contexto separa `domain/`, `application/` e `infrastructure/`, e as regras
que impedem uma camada de importar a outra são executáveis: `pnpm depcruise`.

## Comandos

A lista completa está em [`docs/setup.md`](docs/setup.md) e no
[`CLAUDE.md`](CLAUDE.md). Os do dia a dia:

| | |
|---|---|
| `pnpm dev` | Sobe tudo (web na 3001) |
| `pnpm check` | Biome, corrigindo o que dá |
| `pnpm check-types` | `tsc --noEmit` em todos os workspaces |
| `pnpm test` | Unidade + integração |
| `pnpm db:migrate` | **A** forma de mudar o schema |
| `pnpm db:studio` | Prisma Studio |

> `pnpm db:push` existe, mas grava no banco **sem gerar migration** — a mudança
> fica invisível para os outros ambientes. Use só para experimento descartável.

## Documentação

- [`docs/setup.md`](docs/setup.md) — subir numa máquina nova
- [`docs/architecture.md`](docs/architecture.md) — camadas, contextos e as regras aplicadas
- [`docs/roadmap.md`](docs/roadmap.md) — em que fase o projeto está
- [`docs/pendencias.md`](docs/pendencias.md) — o que falta, e por quê
- [`docs/deploy.md`](docs/deploy.md) — produção
- [`docs/adr/`](docs/adr) — decisões com data e alternativa descartada

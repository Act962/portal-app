# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`portal-app` is a Turborepo/pnpm monorepo scaffolded with [Better-T-Stack](https://better-t-stack.dev): Next.js (App Router) frontend + tRPC API + Prisma/PostgreSQL, using Better-Auth for authentication. There is a single app (`apps/web`) that is fullstack — it hosts both the UI and the tRPC API route handler.

The product is a news portal (Rádio 7 Cidades). Planning docs live in `docs/` and are the source of truth for architecture and scope — read `docs/roadmap.md` first to know which phase is in progress.

## Commands

Run everything from the repo root with pnpm (package manager is pinned to `pnpm@10.24.0`). Turborepo fans commands out to the workspace packages.

```bash
pnpm install          # install all workspace deps
pnpm run dev           # start all apps in dev mode (web on http://localhost:3001)
pnpm run dev:web       # start only the web app
pnpm run build         # build all apps
pnpm run check-types   # tsc --noEmit across all workspaces
pnpm run check         # biome check --write . (lint + format, auto-fixes)
pnpm run depcruise     # dependency-cruiser: enforces the architecture rules over packages/
```

Architecture rules live in `.dependency-cruiser.cjs` (from `docs/architecture.md` §4). Two are active today — `sem-ciclos` (no circular deps) and the `shared-kernel` purity rules (no npm, no other workspace package). The layer/context rules (`domain/` can't import `application/`/`infrastructure/` or npm, `application/` can't import `infrastructure/`, contexts only reach each other through the published package entry) are written but **latent**: they target `packages/contexts/*`, which is created in Phase 1. The scan covers `packages/` for now; `apps/web` (which uses the `@/` alias) joins in Phase 1 with alias resolution wired up.

Database (Prisma + PostgreSQL 17, all proxied to `packages/db` via turbo filters):

```bash
pnpm run db:start      # docker compose up -d (starts local PostgreSQL + Redis)
pnpm run db:migrate     # prisma migrate dev — THE official way to change the schema
pnpm run db:generate    # regenerate the Prisma client
pnpm run db:studio      # open Prisma Studio
pnpm run db:stop        # docker compose stop
pnpm run db:down        # docker compose down
pnpm run db:push        # prototyping only — see warning below
```

**`db:migrate` vs `db:push`.** Migrations under `packages/db/prisma/migrations/` are versioned and are what gets applied in CI and in production. `db:push` writes the schema straight to the database without producing a migration file, so anything done with it is invisible to every other environment. Use it for throwaway local experiments and nothing else; the change only counts once `db:migrate` has produced a migration.

Environment files: copy `apps/web/.env.example` to `apps/web/.env`. If port 5432 is already taken on your machine, copy `packages/db/.env.example` to `packages/db/.env`, set `POSTGRES_PORT`, and use the same port in `DATABASE_URL`.

Tests (Vitest with two projects + Playwright, all run from the repo root — not through Turborepo):

```bash
pnpm run test              # vitest run — unit + integration projects
pnpm run test:unit          # only **/tests/unit/** (no setup, fast)
pnpm run test:integration   # only **/tests/integration/** (spins up Postgres via Testcontainers — Docker required)
pnpm run test:watch         # vitest watch mode
pnpm run test:coverage      # vitest run --coverage
pnpm run test:e2e           # playwright test (starts/reuses the web dev server on :3001)
```

`vitest.config.ts` defines the `unit` and `integration` projects and coverage settings (thresholds from `docs/testing-strategy.md` §10 are written but commented — `fail-under` turns on in Phase 1). Integration tests get a real Postgres from Testcontainers via `tests/integration/global-setup.ts`, which applies the versioned migrations (`prisma migrate deploy`) once and hands the connection URL to tests through vitest's `provide`/`inject`; tests build a non-singleton client with `newPrismaClient(url)` from `@portal-app/db/client`. Shared custom matchers (`toBeErr`, `toContainEventOfType`) live in `tests/setup/matchers.ts`. Playwright E2E specs are in `apps/web/tests/e2e/` (`playwright.config.ts` at root); the auth flow spec (`auth.spec.ts`) writes to the DB and is meant for CI against a dedicated test database, not the local dev DB.

CI runs on GitHub Actions (`.github/workflows/ci.yml`, shared setup in `.github/actions/setup`): a parallel `check` matrix (typecheck · `depcruise` · unit), then `integration` (Testcontainers), `build`, and `e2e` (a Postgres service container + `prisma migrate deploy` + Playwright, so the auth flow spec runs against a dedicated DB). The **lint/format gate (`biome ci`) is intentionally not wired yet** — the scaffold hasn't been Biome-formatted; it joins once the repo is cleaned up. Branch protection on `main` is a GitHub-side setting, not in the repo.

To run a single workspace's script directly, use turbo's filter flag, e.g. `pnpm turbo run check-types -F web` or `pnpm turbo run db:studio -F @portal-app/db`.

## Architecture

### Workspace layout

- `apps/web` — the only app. Next.js 16 App Router, React 19, React Compiler enabled (`babel-plugin-react-compiler` + `reactCompiler: true` in `next.config.ts`), `typedRoutes: true`.
- `packages/api` (`@portal-app/api`) — tRPC router definitions and context. No build step; consumed directly as TS source via subpath exports (e.g. `@portal-app/api/routers/index`, `@portal-app/api/context`).
- `packages/auth` (`@portal-app/auth`) — Better-Auth instance (`createAuth()` / exported singleton `auth`), configured with the Prisma adapter (`provider: "postgresql"`) and the `nextCookies()` plugin.
- `packages/db` (`@portal-app/db`) — Prisma 7 schema (`prisma/schema/*.prisma`, split into `schema.prisma` and `auth.prisma`) and generated client (output to `prisma/generated`, ESM module format). Exports a singleton `PrismaClient` as default export from `src/index.ts`. **Prisma 7 is Rust-free: the client requires a driver adapter** — `createPrismaClient()` builds it with `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })` (`@prisma/adapter-pg` + `pg`). The datasource `url` no longer lives in `schema.prisma`; it moved to `prisma.config.ts` (`defineConfig({ datasource: { url } })`), which is what the CLIs (`migrate`/`generate`/`studio`) read. Regenerate with `pnpm db:generate` after any adapter/schema change.
- `packages/env` (`@portal-app/env`) — typed env vars via `@t3-oss/env-core` (`./server`) and `@t3-oss/env-nextjs` (`./web`), validated with zod. Server env currently defines `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `NODE_ENV`.
- `packages/ui` (`@portal-app/ui`) — shared shadcn/ui primitives and Tailwind v4 global styles, consumed by app(s) via subpath exports (`@portal-app/ui/components/*`, `@portal-app/ui/lib/*`, `@portal-app/ui/hooks/*`, `@portal-app/ui/globals.css`).
- `packages/shared-kernel` (`@portal-app/shared-kernel`) — framework-agnostic DDD primitives: `Result`/`ok`/`err`, `Entity`, `ValueObject`, `AggregateRoot`, `DomainEvent`, and the `Clock`/`IdGenerator` ports (with `SystemClock`/`FixedClock` and `UuidGenerator`/`SequentialIdGenerator`). **Zero external runtime deps by rule** — keeps domain tests fast and immune to library churn; the test doubles ship in the package because they're part of each port's contract. No business concepts here (no `Article`, `Slug`); those live in bounded contexts.
- `packages/config` (`@portal-app/config`) — shared `tsconfig.base.json` extended by every workspace's `tsconfig.json`.

None of the internal packages (`api`, `auth`, `db`, `env`, `ui`) have a build step — they're imported straight as TypeScript source through `package.json` `exports` maps, and workspace deps are declared as `workspace:*`.

### App route groups

`apps/web/src/app` splits into two route groups with different runtime characters — keep the boundary:

- `(site)` — the **public news portal** (home, `[section]`, `[section]/[slug]`, busca, últimas, ao-vivo, menu, 404). All React Server Components: no `Providers`, no React Query, no TanStack devtools. Do not add client providers to this group — the devtools badge leaking onto the portal was a bug caused by exactly that.
- `(app)` — the **authenticated area** (dashboard, login). `Providers` (`apps/web/src/components/providers.tsx` — tRPC `QueryClientProvider` + React Query devtools + `sonner` `Toaster`) wraps `(app)/layout.tsx` only, so client-side data fetching lives here, not in the portal.
- The public portal currently renders from **static fixtures** in `apps/web/src/data/` (`articles.ts`, `authors.ts`, `sections.ts`, etc. — read through `data/queries.ts`), not from the database. The DB-backed domain arrives in later roadmap phases; treat `data/` as the temporary content source until then.

### tRPC flow

- Router definitions live in `packages/api/src/routers/index.ts`, built off `router`/`publicProcedure`/`protectedProcedure` from `packages/api/src/index.ts`. `protectedProcedure` throws `UNAUTHORIZED` if `ctx.session` is missing.
- Context (`packages/api/src/context.ts`) resolves the Better-Auth session from request headers via `auth.api.getSession(...)`.
- The Next.js route handler at `apps/web/src/app/api/trpc/[trpc]/route.ts` wires `appRouter` + `createContext` into `fetchRequestHandler`, handling both GET and POST.
- Client-side, `apps/web/src/utils/trpc.ts` sets up a `QueryClient` (errors are surfaced via `sonner` toasts with a retry action) and a `createTRPCOptionsProxy` (`trpc`) for use with TanStack Query, pointed at `/api/trpc` with `credentials: "include"`.
- Add new endpoints by extending the `appRouter` object in `packages/api/src/routers/index.ts`; the `AppRouter` type is inferred and shared end-to-end.

### Auth flow

- Better-Auth server instance is `packages/auth/src/index.ts`, using the Prisma adapter (`provider: "postgresql"`) and email/password auth.
- The catch-all Next.js route `apps/web/src/app/api/auth/[...all]/route.ts` mounts Better-Auth's handler.
- Client-side auth uses `better-auth/react`'s `createAuthClient` (`apps/web/src/lib/auth-client.ts`).
- Prisma models for auth (`User`, `Session`, `Account`, `Verification`) live in `packages/db/prisma/schema/auth.prisma` and are mapped to lowercase table names (`@@map`). Ids are plain `String` — Better-Auth generates them in the application; the `@default(cuid())` is only a convenience for seeds and manual inserts.

### UI / styling

- shadcn/ui config: style `base-lyra`, base color `neutral`, icon library `lucide`, no class prefix. Two `components.json` files exist — `packages/ui/components.json` (source of truth, `css: src/styles/globals.css`) and `apps/web/components.json` (points back at the shared css and aliases `ui`/`utils`/etc. into `@portal-app/ui`, but `components` into local `@/components` for app-specific blocks).
- To add shared primitives: `npx shadcn@latest add <component> -c packages/ui` from repo root (adds to `packages/ui`). To add app-only blocks, run the shadcn CLI from `apps/web` instead.
- Import shared components as `import { Button } from "@portal-app/ui/components/button"`.
- Global styles / design tokens: `packages/ui/src/styles/globals.css`.
- Theming: `next-themes` via `ThemeProvider` (class attribute, system default) is applied app-wide from the root `layout.tsx`, while the tRPC `QueryClientProvider`, React Query devtools, and `sonner` `Toaster` live in `providers.tsx` and wrap only the `(app)` group (see App route groups above).
- Tailwind v4 `@theme` tokens live in `packages/ui/src/styles/globals.css`. Gotcha: the `--spacing-*` namespace also generates `inline-size` utilities, so never name a spacing token after a display keyword (`block`/`flex`/`grid`) — `--spacing-block` would emit an `.inline-block { inline-size: … }` that collides with the real `display: inline-block` utility.
- `next/font` variables (Archivo/Lora/IBM Plex Mono) must be set on `<html>`, not `<body>` — `--font-sans` is declared at `:root`, so a `<body>`-scoped variable renders the fallback (Times New Roman) instead.

## Testes — dívida assumida na entrega (REGRA)

A partir da Fase 5, features estão indo para produção **sem teste**, por decisão
explícita: o produto precisava ser entregue. A dívida **vai ser paga** — não é
"sem teste", é "teste depois". Duas regras existem para que pagar depois não
custe mais caro do que teria custado escrever na hora:

**1. Todo código novo nasce testável.** A lógica pura sai do componente e vira
módulo `.ts` sem JSX e sem React — o modelo é
`apps/web/src/components/editorial/rich-text/serialize.ts`. Nada de `new Date()`,
`Math.random()` ou I/O escondido dentro de uma regra: o relógio e o id entram por
parâmetro ou pelas portas `Clock`/`IdGenerator` do shared-kernel (é o que já faz
`formatRelativeTime(iso, now)`), e efeito colateral fica atrás de porta. Se para
testar é preciso montar componente, subir banco ou congelar o relógio global, a
regra está no lugar errado — mova antes de seguir.

**2. Toda entrega sem teste deixa o esqueleto pronto.** Cria-se o arquivo em
`tests/unit/` com cada caso escrito como `it.todo("...")`. O `it.todo` é o
registro **executável** do que falta: aparece no relatório do vitest a cada
rodada, ao contrário de um TODO em comentário, que ninguém relê. Escrever o
esqueleto na hora é o momento em que ainda se lembra dos casos-limite — que é
justamente o que se perde ao adiar.

Esqueletos abertos hoje: `apps/web/tests/unit/` (serializador do TipTap,
formatação de data) e `packages/api/tests/unit/` (autorização dos routers).
Estado detalhado em `docs/pendencias.md`.

**A régua de cobertura do domínio (95%) não se baixa** para acomodar código novo
— quando `body.ts` derrubou a cobertura, a decisão foi escrever o teste, não
afrouxar o limite. O domínio é exatamente o que a régua existe para proteger.

## Code style

- Formatting/linting is Biome (`biome.json`), not ESLint/Prettier. Run `pnpm run check` to auto-fix.
- Indent style: tabs. Quote style: double quotes.
- Imports are auto-organized (`assist.actions.source.organizeImports`).
- Notable enforced style rules: no parameter reassignment, `as const` assertions required where inferred, self-closing elements required, single var declarator per statement, no useless `else`, Tailwind class sorting via `useSortedClasses` (recognizes `clsx`, `cva`, `cn`).

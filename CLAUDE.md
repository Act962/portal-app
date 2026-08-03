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
```

Database (Prisma + PostgreSQL 17, all proxied to `packages/db` via turbo filters):

```bash
pnpm run db:start      # docker compose up -d (starts local PostgreSQL)
pnpm run db:migrate     # prisma migrate dev — THE official way to change the schema
pnpm run db:generate    # regenerate the Prisma client
pnpm run db:studio      # open Prisma Studio
pnpm run db:stop        # docker compose stop
pnpm run db:down        # docker compose down
pnpm run db:push        # prototyping only — see warning below
```

**`db:migrate` vs `db:push`.** Migrations under `packages/db/prisma/migrations/` are versioned and are what gets applied in CI and in production. `db:push` writes the schema straight to the database without producing a migration file, so anything done with it is invisible to every other environment. Use it for throwaway local experiments and nothing else; the change only counts once `db:migrate` has produced a migration.

Environment files: copy `apps/web/.env.example` to `apps/web/.env`. If port 5432 is already taken on your machine, copy `packages/db/.env.example` to `packages/db/.env`, set `POSTGRES_PORT`, and use the same port in `DATABASE_URL`.

There is no test suite configured in this repo (no test runner, no `*.test.*`/`*.spec.*` files).

To run a single workspace's script directly, use turbo's filter flag, e.g. `pnpm turbo run check-types -F web` or `pnpm turbo run db:studio -F @portal-app/db`.

## Architecture

### Workspace layout

- `apps/web` — the only app. Next.js 16 App Router, React 19, React Compiler enabled (`babel-plugin-react-compiler` + `reactCompiler: true` in `next.config.ts`), `typedRoutes: true`.
- `packages/api` (`@portal-app/api`) — tRPC router definitions and context. No build step; consumed directly as TS source via subpath exports (e.g. `@portal-app/api/routers/index`, `@portal-app/api/context`).
- `packages/auth` (`@portal-app/auth`) — Better-Auth instance (`createAuth()` / exported singleton `auth`), configured with the Prisma MongoDB adapter and the `nextCookies()` plugin.
- `packages/db` (`@portal-app/db`) — Prisma schema (`prisma/schema/*.prisma`, split into `schema.prisma` and `auth.prisma`) and generated client (output to `prisma/generated`, ESM module format). Exports a singleton `PrismaClient` as default export from `src/index.ts`.
- `packages/env` (`@portal-app/env`) — typed env vars via `@t3-oss/env-core` (`./server`) and `@t3-oss/env-nextjs` (`./web`), validated with zod. Server env currently defines `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `NODE_ENV`.
- `packages/ui` (`@portal-app/ui`) — shared shadcn/ui primitives and Tailwind v4 global styles, consumed by app(s) via subpath exports (`@portal-app/ui/components/*`, `@portal-app/ui/lib/*`, `@portal-app/ui/hooks/*`, `@portal-app/ui/globals.css`).
- `packages/config` (`@portal-app/config`) — shared `tsconfig.base.json` extended by every workspace's `tsconfig.json`.

None of the internal packages (`api`, `auth`, `db`, `env`, `ui`) have a build step — they're imported straight as TypeScript source through `package.json` `exports` maps, and workspace deps are declared as `workspace:*`.

### tRPC flow

- Router definitions live in `packages/api/src/routers/index.ts`, built off `router`/`publicProcedure`/`protectedProcedure` from `packages/api/src/index.ts`. `protectedProcedure` throws `UNAUTHORIZED` if `ctx.session` is missing.
- Context (`packages/api/src/context.ts`) resolves the Better-Auth session from request headers via `auth.api.getSession(...)`.
- The Next.js route handler at `apps/web/src/app/api/trpc/[trpc]/route.ts` wires `appRouter` + `createContext` into `fetchRequestHandler`, handling both GET and POST.
- Client-side, `apps/web/src/utils/trpc.ts` sets up a `QueryClient` (errors are surfaced via `sonner` toasts with a retry action) and a `createTRPCOptionsProxy` (`trpc`) for use with TanStack Query, pointed at `/api/trpc` with `credentials: "include"`.
- Add new endpoints by extending the `appRouter` object in `packages/api/src/routers/index.ts`; the `AppRouter` type is inferred and shared end-to-end.

### Auth flow

- Better-Auth server instance is `packages/auth/src/index.ts`, using the Prisma MongoDB adapter and email/password auth.
- The catch-all Next.js route `apps/web/src/app/api/auth/[...all]/route.ts` mounts Better-Auth's handler.
- Client-side auth uses `better-auth/react`'s `createAuthClient` (`apps/web/src/lib/auth-client.ts`).
- Prisma models for auth (`User`, `Session`, `Account`, `Verification`) live in `packages/db/prisma/schema/auth.prisma` and are mapped to lowercase table names (`@@map`). Ids are plain `String` — Better-Auth generates them in the application; the `@default(cuid())` is only a convenience for seeds and manual inserts.

### UI / styling

- shadcn/ui config: style `base-lyra`, base color `neutral`, icon library `lucide`, no class prefix. Two `components.json` files exist — `packages/ui/components.json` (source of truth, `css: src/styles/globals.css`) and `apps/web/components.json` (points back at the shared css and aliases `ui`/`utils`/etc. into `@portal-app/ui`, but `components` into local `@/components` for app-specific blocks).
- To add shared primitives: `npx shadcn@latest add <component> -c packages/ui` from repo root (adds to `packages/ui`). To add app-only blocks, run the shadcn CLI from `apps/web` instead.
- Import shared components as `import { Button } from "@portal-app/ui/components/button"`.
- Global styles / design tokens: `packages/ui/src/styles/globals.css`.
- Theming: `next-themes` via `ThemeProvider` (class attribute, system default) wrapping the app in `apps/web/src/components/providers.tsx`, alongside the tRPC `QueryClientProvider`, React Query devtools, and the `sonner` `Toaster`.

## Code style

- Formatting/linting is Biome (`biome.json`), not ESLint/Prettier. Run `pnpm run check` to auto-fix.
- Indent style: tabs. Quote style: double quotes.
- Imports are auto-organized (`assist.actions.source.organizeImports`).
- Notable enforced style rules: no parameter reassignment, `as const` assertions required where inferred, self-closing elements required, single var declarator per statement, no useless `else`, Tailwind class sorting via `useSortedClasses` (recognizes `clsx`, `cva`, `cn`).

# CLAUDE.md

Project memory and working conventions for **Ticketly** — an AI-powered ticket
management system. Claude reads this file at the start of every session; keep
it accurate and focused. Full design lives in [project-scope.md](./project-scope.md),
[tech-stack.md](./tech-stack.md), and [implementation-plan.md](./implementation-plan.md)
(phase-by-phase status is tracked there).

## What this is

A decoupled monorepo (npm workspaces):

- `api/` — **NestJS 11** REST API (`@ticketly/api`), port 3000. Swagger at `/api/docs`.
- `web/` — **Vite 8 + React 19** SPA (`@ticketly/web`), port 5173.
- `shared/` — **`@ticketly/shared`**, Zod schemas + types imported by both. **Build-time only** — it is compiled INTO both bundles and is never hosted on its own.

## Commands (from repo root)

| Command | Purpose |
| --- | --- |
| `npm run setup` | install + build `shared` + `prisma generate` |
| `npm run dev` | build `shared`, then run api + web concurrently |
| `npm run build` | build `shared` → `api` → `web` |
| `npm run db:generate` | regenerate the Prisma client |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | seed the bootstrap admin |
| `npm run db:studio` | Prisma Studio |
| `npm run lint` / `lint:fix` | ESLint 10 (flat config) across all workspaces |

Build ordering matters: **`shared` must build before `api` and `web`** (both import
`@ticketly/shared`, which resolves to `shared/dist`). The root scripts already enforce this.

## Toolchain — hard requirements

- **Node.js ≥ 24** (`.nvmrc` = `24`). Always use Node 24.
- **TypeScript 6.0.3 across all three workspaces** — do not introduce a different TS version. Verified compatible with NestJS 11 / Vite 8 / React 19 / `typescript-eslint` 8.61 (supports TS `<6.1`).
- npm workspaces; package names are `@ticketly/{api,web,shared}`.

## Backend (`api/`) conventions

- Global route prefix is **`/api`**; **`/health` is intentionally excluded** and served at the root — `GET /health` → `{ status, service, time }`.
- **CORS** allowlist comes from `WEB_ORIGIN` (comma-separated) in `api/src/main.ts`; defaults to `http://localhost:5173`. Set it to the frontend origin in production.
- **Better Auth** is mounted via `@thallesp/nestjs-better-auth` (`AuthModule.forRoot({ auth })` in `app.module.ts`) at `/api/auth/*` with a **global `AuthGuard`**. The full setup — config, roles, closed registration, client flow — is in the **Authentication** section below.
- **Env-load ordering gotcha:** `api/src/auth/auth.config.ts` constructs its `PrismaClient` at **import time**, which runs *before* Nest's `ConfigModule` loads `.env` — so `DATABASE_URL` was empty and Better Auth hit `ECONNREFUSED`. Fixed by `import "dotenv/config"` as the **first line of `main.ts`**. Do not remove it.
- Port from `PORT` env (default 3000).

## Frontend (`web/`) conventions

- `VITE_API_URL` = backend **origin only** (no `/api` suffix), e.g. `https://ticketly.up.railway.app`. Leave **blank in dev** — Vite proxies `/api` and `/health` to the backend (`vite.config.ts`), keeping cookies same-origin. This matches Better Auth's `baseURL` in `lib/auth.ts`.
- The API client (`lib/api.ts`) prepends `/api` itself: call `api("/auth/...")`. The one exception is **health at the root** → `getHealth()` hits `${origin}/health`.
- ESLint 10 flat config in `eslint.config.mjs`; React plugins are registered by hand (ESLint 10 rejects the legacy `plugins: [...]` array form the plugin presets still ship).
- **Build all UI with [shadcn/ui](https://ui.shadcn.com)** — not hand-rolled primitives or other component libraries. Config is `web/components.json` (`new-york` style, `neutral` base color, CSS variables, lucide icons); generated components live in `web/src/components/ui/`. **Add new ones via the shadcn CLI run from `web/`** (`npx shadcn@latest add <name>`) — they're copied in and can then be edited freely.
- **Styling uses Tailwind utilities + the design tokens** defined in `web/src/index.css` (`bg-background`, `text-muted-foreground`, `text-destructive`, `border`, etc.) — **never hardcode hex colors**. Compose existing shadcn primitives; don't reinvent them.

## Authentication

[Better Auth](https://www.better-auth.com) (`@thallesp/nestjs-better-auth`) — email/password + **admin** (roles) plugin, Prisma adapter, **DB-backed cookie sessions**. No OAuth.

- **Server:** configured in `api/src/auth/auth.config.ts`, mounted in `app.module.ts` at `/api/auth/*` with a **global `AuthGuard`** — routes without `@AllowAnonymous()` return 401 when there's no session. `main.ts` uses `{ bodyParser: false }`. `BETTER_AUTH_SECRET` is read automatically from env.
- **Client:** the `better-auth/react` client in `web/src/lib/auth.ts` exposes a reactive `useSession()`; the session cookie rides on `credentials: "include"` in `web/src/lib/api.ts`. Route guard: `web/src/components/auth/require-auth.tsx`.
- **Registration is closed** (`disableSignUp: true`). Accounts are provisioned by the seed or an admin — bootstrap one with `npm run db:seed` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
- **Roles:** `enum Role { admin, agent }` (lowercase, matches the admin plugin; default `agent`). Admins are set via seed/createUser.

## Prisma 7 — gotchas

- Uses the **`prisma-client` generator** (not the legacy `prisma-client-js`); the client is generated to **`api/src/generated/prisma`**, which is gitignored. After cloning, run `npm run db:generate`.
- Runtime uses a **`@prisma/adapter-pg` driver adapter** (`PrismaPg`); the connection string comes from `DATABASE_URL`.
- The **migrate datasource URL lives in `api/prisma.config.ts`**, NOT in `schema.prisma` (the `datasource db` block has no `url` field). Do not move it back.
- **Destructive Prisma operations** (`prisma migrate reset`, data-losing `migrate dev`, dropping tables) require **explicit user consent**, passed via the `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var containing the consent text. Never run them unilaterally.

## Security / don'ts

- **Never run `npm audit fix --force`** — it downgrades NestJS/Prisma/Swagger majors and breaks the tree. Known transitive vulns are pinned via the root `package.json` **`overrides`** block (`multer` / `js-yaml` / `@hono/node-server`); preserve it. If overrides don't take effect on an already-installed tree, the fix is a clean `rm -rf node_modules package-lock.json && npm install` — never `--force`.
- `.gitignore` must keep ignored: `.claude/settings.local.json`, `.env*` (except `.env.example`), `**/generated/prisma/`, `*.tsbuildinfo`.
- **Never commit secrets.** `.env*` is gitignored. If a key/token ever lands in shell history, a transcript, or a file, treat it as compromised and rotate it.

## `api/tsconfig.json`

`baseUrl: "./"` is **intentional** — do not revert it. `incremental` was intentionally removed (it caused an empty `dist/`).

## Git

The default/working branch is **`local`** (not `main`). Use `local` for branch references and as the production/deploy branch on Vercel/Railway.

## AI provider

The product's LLM is **GLM 5.2** via Zhipu's OpenAI-compatible endpoint — **not Claude**. Flash-tier GLM handles classify/summarize; Zhipu `embedding-3` powers RAG over pgvector. Do not wire Anthropic/Claude APIs into product features.

## Looking up docs — use context7

Use the **context7 MCP server** to fetch up-to-date documentation **before relying on memory** for any library/framework in this stack: NestJS, Prisma, Better Auth (`@thallesp/nestjs-better-auth`), Vite, React, React Router, Zod, Zustand, Tailwind, shadcn/ui, Inngest, SendGrid. These move fast and training data goes stale.

- Call `mcp__context7__resolve-library-id` first to get the Context7 library id, then `mcp__context7__query-docs` with it.
- Prefer context7 over web search for library/API questions (config, version migration, exact API syntax).
- Do **not** use it for: refactors, writing code from scratch, debugging app logic, or general programming concepts.

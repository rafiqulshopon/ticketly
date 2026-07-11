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
- `shared/` — **`@ticketly/shared`**, Zod schemas + types imported by all. **Build-time only** — it is compiled INTO both bundles and is never hosted on its own.
- `mobile/` — **Expo SDK 57 + React Native 0.86** app (`@ticketly/mobile`), React 19.2. Consumes the same REST API and reuses `@ticketly/shared`. See the **Mobile** section below.

## Commands (from repo root)

| Command | Purpose |
| --- | --- |
| `npm run setup` | install + build `shared` + `prisma generate` |
| `npm run dev` | build `shared`, then run api + web concurrently |
| `npm run dev:mobile` | start the Expo Metro packager for `mobile/` (run separately from api+web — the RN packager is a different process) |
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
- **TypeScript 6.0.3 across all four workspaces** — do not introduce a different TS version. Verified compatible with NestJS 11 / Vite 8 / React 19 / Expo SDK 57 / `typescript-eslint` 8.61 (supports TS `<6.1`).
- npm workspaces; package names are `@ticketly/{api,web,shared,mobile}`.

## Backend (`api/`) conventions

- Global route prefix is **`/api`**; **`/health` is intentionally excluded** and served at the root — `GET /health` → `{ status, service, time }`.
- **CORS** allowlist comes from `WEB_ORIGIN` (comma-separated) in `api/src/main.ts`; defaults to `http://localhost:5173`. Set it to the frontend origin in production.
- **Better Auth** is mounted via `@thallesp/nestjs-better-auth` (`AuthModule.forRoot({ auth })` in `app.module.ts`) at `/api/auth/*` with a **global `AuthGuard`**. The full setup — config, roles, closed registration, client flow — is in the **Authentication** section below.
- **Env-load ordering gotcha:** `api/src/auth/auth.config.ts` constructs its `PrismaClient` at **import time**, which runs *before* Nest's `ConfigModule` loads `.env` — so `DATABASE_URL` was empty and Better Auth hit `ECONNREFUSED`. Fixed by loading `dotenv/config` before any app module. It now lives as the **first line of `api/src/instrument.ts`**, which `main.ts` imports as its very first line (ahead of Sentry init). Do not move dotenv out of that first-import position.
- **Sentry** (error logging, errors-only) is initialized in `api/src/instrument.ts` (`@sentry/nestjs`); `SentryGlobalFilter` is the global exception filter in `app.module.ts`. Disabled when `SENTRY_DSN` is unset. On the web side, `@sentry/react` `Sentry.init` + `Sentry.ErrorBoundary` are in `web/src/main.tsx`; source-map upload via `@sentry/vite-plugin` is gated on `SENTRY_AUTH_TOKEN` in `vite.config.ts`.
- Port from `PORT` env (default 3000).

## Frontend (`web/`) conventions

- `VITE_API_URL` = backend **origin only** (no `/api` suffix), e.g. `https://ticketly.up.railway.app`. Leave **blank in dev** — Vite proxies `/api` and `/health` to the backend (`vite.config.ts`), keeping cookies same-origin. This matches Better Auth's `baseURL` in `lib/auth.ts`.
- **Data fetching: TanStack Query + the axios client in `lib/api.ts` — never raw `fetch`** (the only exception is Better Auth's own client in `lib/auth.ts`). `api("/users")` prepends `/api`; HTTP errors throw `ApiError(status)`.
- ESLint 10 flat config in `eslint.config.mjs`; React plugins are registered by hand (ESLint 10 rejects the legacy `plugins: [...]` array form the plugin presets still ship).
- **Build all UI with [shadcn/ui](https://ui.shadcn.com)** — not hand-rolled primitives or other component libraries. Config is `web/components.json` (`new-york` style, `neutral` base color, CSS variables, lucide icons); generated components live in `web/src/components/ui/`. **Add new ones via the shadcn CLI run from `web/`** (`npx shadcn@latest add <name>`) — they're copied in and can then be edited freely.
- **Styling uses Tailwind utilities + the design tokens** defined in `web/src/index.css` (`bg-background`, `text-muted-foreground`, `text-destructive`, `border`, etc.) — **never hardcode hex colors**. Compose existing shadcn primitives; don't reinvent them.
- **Component tests** (Vitest + React Testing Library) live as `*.test.tsx` next to the component. Run `npm test --workspace @ticketly/web` (or `test:watch`). Mock `@/lib/api` (never hit the network); wrap data components in a fresh `QueryClientProvider` with `retry: false`; import from `vitest` explicitly (no globals).

## Mobile (`mobile/`) conventions

- **Expo SDK 57** (React Native 0.86, React 19.2 — matches the web) + **Expo Router** (file-based routes in `mobile/src/app/`, route groups `(auth)` / `(app)`). Run with `npm run dev:mobile` — **separate from `npm run dev`** (the RN packager is a different process; don't add it to the concurrent api+web script).
- **Styling: NativeWind v4** (Tailwind v3) — the *stable* release (v5 is preview only, not on the `latest` dist-tag). Config is `mobile/tailwind.config.js` + `mobile/src/global.css` (the "Signal" tokens ported from `web/src/index.css` — values identical, only the mechanism differs: v3 `@tailwind` directives + `theme.extend.colors` mapped to CSS vars vs. the web's v4 `@theme inline`). Same rule: **never hardcode hex colors**. `babel.config.js` sets `jsxImportSource: "nativewind"` so `className` works on RN primitives.
- **Auth: the `@better-auth/expo` plugin.** RN has no browser cookie jar or native `EventSource`, so the web's `withCredentials`/`EventSource` flow does not apply. The mobile client (`mobile/src/lib/auth.ts`) uses the same `better-auth/react` `createAuthClient` + an `expoClient` plugin backed by `expo-secure-store` (Keychain / Encrypted SharedPreferences). The session cookie is persisted in SecureStore and attached to every request as a `Cookie` header via an axios interceptor that calls `authClient.getCookie()` (`mobile/src/lib/api.ts`). The **server enables this** with the `expo()` plugin + the `ticketly://` scheme in `trustedOrigins` (`api/src/auth/auth.config.ts`) — the web client is completely unaffected (cookies still work alongside it).
- **Env:** `EXPO_PUBLIC_API_URL` = full backend origin (no `/api` suffix). There is **no dev proxy on a device**, so it must be reachable: `http://localhost:3000` on the simulator, the dev machine's LAN IP for a physical device, the Railway URL in prod. Expo inlines `EXPO_PUBLIC_*` at build time (analog of Vite's `VITE_`).
- **`@ticketly/shared` in dev:** `mobile/metro.config.js` aliases `@ticketly/shared` to its **TS source** (`../shared/src`) via `extraNodeModules` + `watchFolders`, so shared edits hot-reload — RN has no Vite proxy and the built `shared/dist` is CommonJS (the "does not provide an export named" gotcha). This mirrors the web's dev alias; no rebuild of shared is needed for mobile.
- **Realtime:** SSE via `react-native-sse` (RN has no native `EventSource`) with the `Cookie` header, in `mobile/src/hooks/use-realtime-events.ts` — ported from the web hook; same TanStack Query keys + invalidation semantics. Toasts use `react-native-toast-message` (not `sonner`).
- **Tests: Jest + `@testing-library/react-native`** — **not Vitest** (Vitest can't drive Metro/RN transforms). This is the one toolchain divergence from the web.
- **Justified divergences from web:** Expo Router (not React Router); `FlatList` (not `@tanstack/react-table`); `victory-native` (not `recharts`); `lucide-react-native` (not `lucide-react`); bottom sheets / `react-native-modal` (not Radix dialogs). Forms still use `react-hook-form` + `@hookform/resolvers/zod` + `zod` (same as web).
- **Mobile is NOT in the Docker image** — `.dockerignore` excludes `mobile/`. It ships as a standalone binary (EAS Build / app stores) consuming the same HTTP API. The Dockerfile's explicit `package.json` copies already exclude it.

## Authentication

[Better Auth](https://www.better-auth.com) (`@thallesp/nestjs-better-auth`) — email/password + **admin** (roles) plugin, Prisma adapter, **DB-backed cookie sessions**. No OAuth.

- **Server:** configured in `api/src/auth/auth.config.ts`, mounted in `app.module.ts` at `/api/auth/*` with a **global `AuthGuard`** — routes without `@AllowAnonymous()` return 401 when there's no session. `main.ts` uses `{ bodyParser: false }`. `BETTER_AUTH_SECRET` is read automatically from env.
- **Client:** the `better-auth/react` client in `web/src/lib/auth.ts` exposes a reactive `useSession()`; the session cookie rides on `credentials: "include"` in `web/src/lib/api.ts`. Route guard: `web/src/components/auth/require-auth.tsx`.
- **Registration is closed** (`disableSignUp: true`). Accounts are provisioned by the seed or an admin — bootstrap one with `npm run db:seed` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
- **Roles:** `enum Role { admin, agent }` (lowercase, matches the admin plugin; default `agent`). Admins are set via seed/createUser.
- **Every route handler needs an access decision** — `@AllowAnonymous()`, `@Authenticated()` (any user), `@Roles(["admin"])`, or `@OrgRoles(...)`, on the method or the `@Controller` class. Enforced by the `ticketly/require-auth-decision` lint rule (fails `npm run lint`). Scope owned resources (`Ticket.assigneeId`, `Message.senderId`, `Draft.agentId`) by the caller via `@Session()`; agents see only their own, admins see all.

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

## Deployment (Railway)

Single service: the **API also serves the built SPA** (`@nestjs/serve-static` in `api/src/app.module.ts`, guarded by `existsSync` so dev is untouched) so everything is same-origin and Better Auth cookies need no CORS. Root `Dockerfile` (multi-stage) + `railway.json` (healthcheck on `/health`); full guide in [README.md](./README.md#deploy-to-railway). Invariants:

- The **DB stays external on Neon** (pgvector), not Railway Postgres. Railway only hosts the app; `DATABASE_URL` points at Neon.
- Use Neon's **direct (non-pooled) endpoint** for `DATABASE_URL` — `prisma migrate deploy` runs at container start (`CMD` in the Dockerfile) and hangs on the pooled `-pooler` endpoint.
- `prisma` is a **dependency** (not devDep) of `@ticketly/api` so `migrate deploy` survives the runtime stage's `npm ci --omit=dev`. Don't move it back to devDeps.
- The root `build` script runs `db:generate` (prisma generate) before the API build — `auth.config.ts` imports the gitignored generated client.
- `api/public/` is gitignored — it's the SPA copy the Docker build makes; its presence in dev would make `ServeStaticModule` shadow the Vite proxy.
- In prod set `BETTER_AUTH_URL` + `WEB_ORIGIN` to the Railway HTTPS URL (`auth.config.ts` throws if `BETTER_AUTH_URL` isn't `https://` when `NODE_ENV=production`). Leave `VITE_API_URL` blank (same-origin).

## AI provider

The product's LLM is **GLM 5.2** via Zhipu's OpenAI-compatible endpoint — **not Claude**. Flash-tier GLM handles classify/summarize; Zhipu `embedding-3` powers RAG over pgvector. Do not wire Anthropic/Claude APIs into product features.

## Looking up docs — use context7

Use the **context7 MCP server** to fetch up-to-date documentation **before relying on memory** for any library/framework in this stack: NestJS, Prisma, Better Auth (`@thallesp/nestjs-better-auth`), Vite, React, React Router, Expo, React Native, NativeWind, Expo Router, Zod, TanStack Query, Tailwind, shadcn/ui, pg-boss, Resend. These move fast and training data goes stale.

- Call `mcp__context7__resolve-library-id` first to get the Context7 library id, then `mcp__context7__query-docs` with it.
- Prefer context7 over web search for library/API questions (config, version migration, exact API syntax).
- Do **not** use it for: refactors, writing code from scratch, debugging app logic, or general programming concepts.

# Ticketly

AI-powered ticket management system. A decoupled monorepo: a **Vite + React** SPA (`web/`), a **NestJS** API (`api/`), and an **Expo / React Native** mobile app (`mobile/`), sharing Zod schemas via `shared/`.

Full design lives in [project-scope.md](./project-scope.md), [tech-stack.md](./tech-stack.md), and [implementation-plan.md](./implementation-plan.md).

## Prerequisites

- **Node.js** ≥ 24 (see `.nvmrc`)
- **npm**
- A **Postgres** database with the **pgvector** extension (e.g. Neon — run `CREATE EXTENSION IF NOT EXISTS vector;` in the SQL editor)

## Structure

```
ticketly/
├── api/                    # NestJS backend (@ticketly/api)
│   ├── prisma/
│   │   ├── schema.prisma   # data model: auth tables + Ticket/Message/Kb*/Draft
│   │   └── seed.ts         # bootstrap admin
│   └── src/
│       ├── app.*           # health endpoint
│       ├── auth/           # Better Auth instance (handler wiring = Phase 1)
│       └── prisma/         # PrismaService (global)
├── web/                    # Vite + React SPA (@ticketly/web)
│   └── src/
│       ├── components/      # shadcn/ui (Button) + layout
│       ├── lib/            # api client, Better Auth client, cn()
│       ├── routes/         # dashboard + login placeholders
│       └── stores/         # Zustand auth store
├── shared/                 # @ticketly/shared — Zod schemas + types (api + web + mobile)
├── mobile/                 # Expo SDK 57 + React Native app (@ticketly/mobile)
└── package.json            # npm workspaces + convenience scripts
```

## First-time setup

```bash
# 1. Install all workspaces (run from repo root)
npm install

# 2. Build the shared package once (api + web import its types)
npm run build --workspace @ticketly/shared

# 3. Create the DB + enable pgvector (Neon SQL editor):
#    CREATE EXTENSION IF NOT EXISTS vector;

# 4. Configure env
cp api/.env.example api/.env      # set DATABASE_URL, BETTER_AUTH_SECRET, seed creds
cp web/.env.example web/.env      # leave VITE_API_URL blank (dev uses the proxy)
cp mobile/.env.example mobile/.env  # EXPO_PUBLIC_API_URL=http://localhost:3000 (simulator)

# 5. Generate Prisma client + create tables
npm run db:migrate                # creates auth tables + Ticket/Message/Kb*/Draft

# 6. Seed a bootstrap admin
npm run db:seed

# 7. Run both apps in dev
npm run dev
```

## Ports

- **API**: http://localhost:3000 — Swagger at `/api/docs`, health at `/health`
- **Web**: http://localhost:5173 — proxies `/api` → `:3000` (so sessions/cookies just work in dev)
- **Mobile**: Expo Metro packager on `:8081` — talks to the API directly at `EXPO_PUBLIC_API_URL` (no dev proxy on a device)

## Scripts (from repo root)

| Script | What it does |
| --- | --- |
| `npm run setup` | install + build shared + `prisma generate` |
| `npm run dev` | run api (`nest --watch`) + web (`vite`) concurrently |
| `npm run dev:mobile` | start the Expo Metro packager for `mobile/` (run separately — RN packager is a different process) |
| `npm run build` | build shared → api → web |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:generate` | `prisma generate` |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | seed the bootstrap admin |
| `npm run lint` | lint all workspaces (ESLint 10, flat config) |
| `npm run lint:fix` | lint + auto-fix across workspaces |

## Mobile app (`mobile/`)

An Expo SDK 57 (React Native 0.86, React 19.2) app that mirrors the web — same
REST API, same `@ticketly/shared` schemas. Distributed as a standalone binary
(EAS Build / app stores); **not** part of the Railway Docker image.

**Auth:** RN has no browser cookie jar, so the mobile client uses
`@better-auth/expo` — the session cookie lives in `expo-secure-store`
(Keychain / Encrypted SharedPreferences) and is attached as a `Cookie` header on
every request. The backend enables this with the `expo()` plugin + the
`ticketly://` scheme in `trustedOrigins` (`api/src/auth/auth.config.ts`); the
web's cookie flow is unchanged.

```bash
# Configure env (FULL API origin — no dev proxy on a device)
cp mobile/.env.example mobile/.env
#   EXPO_PUBLIC_API_URL=http://localhost:3000   # iOS simulator
#   EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3000  # physical device

# Start the packager (separate from api+web)
npm run dev:mobile                  # → npx expo start
#   press i (iOS sim), a (Android), or scan the QR with Expo Go

npx expo install --fix              # align expo-* / react-native-* versions after install, if needed
```

Feature status is tracked per-milestone in [implementation-plan.md](./implementation-plan.md).

## Deploy to Railway

Ticketly ships as a **single service**: the NestJS API also serves the compiled
SPA (`@nestjs/serve-static`), so everything runs on one origin and Better Auth
session cookies ride same-origin with no CORS/SameSite tuning. Railway builds it
from the root [`Dockerfile`](./Dockerfile); [`railway.json`](./railway.json)
wires the `/health` healthcheck.

The **database stays external on Neon** — Railway's managed Postgres has no
`pgvector`, which the schema requires. Railway only hosts the app; it connects
to Neon over `DATABASE_URL`.

### 1. Provision the database (Neon)

Create a Neon project, enable pgvector (`CREATE EXTENSION IF NOT EXISTS vector;`),
and copy the **direct** (non-pooled) connection string — the one **without**
`-pooler` in the host. `prisma migrate deploy` (run at container start) needs the
direct endpoint; the pooled `-pooler` endpoint hangs on Neon (see the
`neon-migrate-pooled-connection-hang` note). A single replica doesn't need
pooling.

### 2. Create the Railway service

- **New Project → Deploy from GitHub repo** (the working branch is `local`).
  Railway auto-detects the Dockerfile and applies `railway.json`.
- **Settings → Networking → Generate Domain** and note the public URL
  (e.g. `https://ticketly.up.railway.app`). The app won't boot in production
  until `BETTER_AUTH_URL`/`WEB_ORIGIN` are set to this URL (see below) — expect
  the first deploy to fail until you set them, then it'll go green on redeploy.

### 3. Environment variables (Variables tab)

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon **direct** (non-pooled) connection string |
| `NODE_ENV` | `production` |
| `BETTER_AUTH_SECRET` | long random string (e.g. `openssl rand -hex 32`) |
| `BETTER_AUTH_URL` | your Railway HTTPS URL (must be `https://` — checked at boot) |
| `WEB_ORIGIN` | same Railway HTTPS URL (same-origin; needed for Better Auth's origin check) |
| `SEED_ADMIN_EMAIL` | bootstrap admin email |
| `SEED_ADMIN_PASSWORD` | strong password (≥ 12 chars; the seed rejects weak ones) |
| `AI_API_KEY` | Zhipu/OpenAI-compatible key (reply polish returns 502 without it) |
| `AI_BASE_URL` | provider base URL (default OpenRouter) |
| `AI_MODEL` | model id (default `openai/gpt-5-nano`) |
| `RESEND_API_KEY` | Resend key (email; optional — outbound disabled if unset) |
| `RESEND_WEBHOOK_SECRET` | Svix secret for the inbound webhook (optional) |
| `MAIL_FROM` / `MAIL_FROM_NAME` | verified Resend sender |
| `SENTRY_DSN` | optional (server errors; no-op if unset) |

`PORT` is **injected by Railway** — don't set it. `VITE_API_URL` stays **blank**
(same-origin; the build bakes in the empty default, so requests hit the API on
the same origin).

### 4. Migrations + seed (first deploy)

- **Migrations run automatically** on every container start
  (`prisma migrate deploy` before `node dist/main`), so tables are created on
  first boot. Watch the deploy logs for `migrate deploy` output.
- **Seed the bootstrap admin once**, from your local machine against the
  production DB (the runtime image has no `tsx`):

  ```bash
  # temporarily point your local api/.env at Neon, then:
  npm run db:seed
  ```

### 5. Custom domain

If you attach a custom domain, update `BETTER_AUTH_URL` and `WEB_ORIGIN` to it
and redeploy. Resend's inbound webhook (if used) points at
`POST https://<api-origin>/api/channels/email/inbound/resend`.

### Local image build (optional sanity check)

```bash
docker build -t ticketly .
# PORT + DATABASE_URL + BETTER_AUTH_URL etc. must be supplied to run it
```

## Notes

- **TypeScript 6.0.3** is used across all four workspaces, verified compatible with the current framework set (NestJS 11 / Vite 8 / React 19 / Expo SDK 57 / `@types/react`) and the lint toolchain (`typescript-eslint` 8.61 supports TS `<6.1`).
- **Linting**: ESLint 10 flat configs live in each workspace's `eslint.config.mjs`; `npm run lint` checks all three. The `web/` config registers the React plugins by hand because ESLint 10 rejects the legacy `plugins: [...]` array form the plugins' own presets still ship.
- **Prisma 7**: uses the `prisma-client` generator (client generated to `api/src/generated/prisma`) + a runtime `@prisma/adapter-pg` driver adapter. The migrate datasource URL lives in `api/prisma.config.ts`, **not** in `schema.prisma`. After cloning, run `npm run db:generate` to produce the client (it's gitignored).
- **Better Auth**: the `auth` instance is configured (email/password + admin plugin + Prisma adapter), but the HTTP handler and session guard are **Phase 1** work — see `api/src/auth/auth.config.ts`.
- **pgvector**: the `KbChunk.embedding` column and similarity search are **Phase 4** (RAG); the field is declared `Unsupported` in the schema until then.

> Project status is tracked per-phase in [implementation-plan.md](./implementation-plan.md).

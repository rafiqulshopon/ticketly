# Ticketly

AI-powered ticket management system. A decoupled monorepo: a **Vite + React** SPA (`web/`) and a **NestJS** API (`api/`), sharing Zod schemas via `shared/`.

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
├── shared/                 # @ticketly/shared — Zod schemas + types (api + web)
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

## Scripts (from repo root)

| Script | What it does |
| --- | --- |
| `npm run setup` | install + build shared + `prisma generate` |
| `npm run dev` | run api (`nest --watch`) + web (`vite`) concurrently |
| `npm run build` | build shared → api → web |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:generate` | `prisma generate` |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | seed the bootstrap admin |
| `npm run lint` | lint all workspaces (ESLint 10, flat config) |
| `npm run lint:fix` | lint + auto-fix across workspaces |

## Notes

- **TypeScript 6.0.3** is used across all three workspaces, verified compatible with the current framework set (NestJS 11 / Vite 8 / React 19 / `@types/react`) and the lint toolchain (`typescript-eslint` 8.61 supports TS `<6.1`).
- **Linting**: ESLint 10 flat configs live in each workspace's `eslint.config.mjs`; `npm run lint` checks all three. The `web/` config registers the React plugins by hand because ESLint 10 rejects the legacy `plugins: [...]` array form the plugins' own presets still ship.
- **Prisma 7**: uses the `prisma-client` generator (client generated to `api/src/generated/prisma`) + a runtime `@prisma/adapter-pg` driver adapter. The migrate datasource URL lives in `api/prisma.config.ts`, **not** in `schema.prisma`. After cloning, run `npm run db:generate` to produce the client (it's gitignored).
- **Better Auth**: the `auth` instance is configured (email/password + admin plugin + Prisma adapter), but the HTTP handler and session guard are **Phase 1** work — see `api/src/auth/auth.config.ts`.
- **pgvector**: the `KbChunk.embedding` column and similarity search are **Phase 4** (RAG); the field is declared `Unsupported` in the schema until then.

> Project status is tracked per-phase in [implementation-plan.md](./implementation-plan.md).

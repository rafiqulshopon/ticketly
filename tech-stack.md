# Tech Stack

Decoupled architecture: a **React SPA frontend** and a **NestJS backend API**, talking over REST. The two apps can live in one repo (e.g. `web/` and `api/`) or in separate repos.

## Frontend (`web/`)

- **React + TypeScript** — single-page app
- **Vite** — build tool / dev server
- **React Router** — client-side routing
- **Tailwind CSS** — styling
- **shadcn/ui** — component library (React + Tailwind, framework-agnostic)
- **react-email** — reply/email templates (renders to HTML/text the backend sends)
- **Zod** — form/input validation (schemas shared with the backend)
- **TanStack Query** — server-state / data-fetching (caching, dedup, background refetch, loading + error state). The standard way to fetch API data in `web/` — never use raw `fetch`.
- **Axios** — HTTP transport behind the shared client in `lib/api.ts` (`withCredentials` carries the session cookie). Auth/session state comes from Better Auth's reactive `useSession()`; remaining UI state stays local in components.

## Mobile (`mobile/`)

- **Expo SDK 57 + React Native 0.86** (React 19.2) — **Expo Router** for file-based navigation. Distributed as a standalone app binary (EAS Build / app stores); consumes the same REST API as the web. Not part of the Railway Docker image.
- **NativeWind v4** (Tailwind v3) — the *stable* release (v5 is preview only). Brings the web's Tailwind token model to RN; the "Signal" tokens are ported from `web/src/index.css`.
- **Auth: `@better-auth/expo`** — the mobile client persists the Better Auth session cookie in `expo-secure-store` and attaches it as a `Cookie` header (RN has no browser cookie jar). The server enables this via the `expo()` plugin + the `ticketly://` scheme in `trustedOrigins`; the web's cookie flow is unchanged.
- **TanStack Query + Axios** — same data-fetching model as the web (shared query keys, `ApiError`). **Realtime** via `react-native-sse` (RN has no native `EventSource`) with the cookie header.
- **Zod** — shared schemas reused from `@ticketly/shared`.
- **Tests: Jest + `@testing-library/react-native`** (not Vitest — Vitest can't drive Metro/RN transforms).

## Backend (`api/`)

- **NestJS + TypeScript** — REST API, with auto-generated Swagger/OpenAPI docs
- **Prisma** — ORM / data layer
- **Zod** — request validation (shared schemas with the frontend)
- **Auth: Better Auth (NestJS adapter)** — local credentials for Admin and Agent. Students never log in (email-only).
  - _Note: uses `@thallesp/nestjs-better-auth`, sessions live in Postgres so logout/revocation is instant, and the built-in role plugin maps cleanly onto Admin/Agent. Community-maintained, not official, Fastify support is still beta. Fall back to NestJS-native Passport/JWT if you'd rather depend only on official packages, or swap for Clerk/WorkOS if you'd rather not run auth yourself._

## Data

- **PostgreSQL + pgvector** — relational data and vector store in one
- **Neon** — Postgres hosting (serverless connection pooling)

## AI

- **Drafts: GLM 5.2** via Zhipu's OpenAI-compatible endpoint (1M context window)
- **Classify & summarize: a Flash-tier GLM model** — cheaper/faster for high-volume tasks (confirm current model name on Zhipu's platform)
- **Embeddings: Zhipu embedding-3** → pgvector, for RAG over the knowledge base (keeps chat + embeddings on one vendor)

## Email

- **Resend** — Inbound webhook (receive support emails → create tickets) + outbound sending for agent replies. The inbound webhook is Svix-signed and verified by the NestJS backend, which then fetches the full email via the Resend API.

## Background jobs

- **pg-boss** — Postgres-backed job queue for the ticket-arrival fan-out (classify, and later draft/summarize) with retries and observability. Chosen because it reuses the existing Postgres — no Redis or extra service to run (unlike Inngest/BullMQ). pg-boss manages its own `pgboss` schema; the worker runs in the API process today and can be split out later.
  - _Alternative considered: Inngest or BullMQ + Redis if a hosted/Redis-backed queue is ever preferred._

## Infrastructure & deploy

- **Frontend**: Vercel — static SPA
- **Backend**: Railway — long-running NestJS Node service
- **CORS**: SPA and API run on separate origins, so the backend must allow the frontend's origin.

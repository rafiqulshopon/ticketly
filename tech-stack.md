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
- **Zustand** — lightweight state store (UI state + cached server data, fetched via the API client)

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

- **SendGrid** — Inbound Parse webhook (receive support emails → create tickets) + outbound sending for agent replies. The webhook is received and verified by the NestJS backend.

## Background jobs

- **Inngest** — ticket-arrival fan-out (classify + generate draft) with retries and observability.
  - _Alternative: BullMQ + Redis if you'd rather self-host the queue._

## Infrastructure & deploy

- **Frontend**: Vercel — static SPA
- **Backend**: Railway — long-running NestJS Node service
- **CORS**: SPA and API run on separate origins, so the backend must allow the frontend's origin.

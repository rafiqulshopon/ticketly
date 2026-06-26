# Implementation Plan

**Philosophy:** build a thin vertical slice first — a _working manual ticket system_ — then layer the AI on top. This de-risks the architecture (email loop, threading, auth, dashboard) before the AI value depends on it, and gives agents something usable early.

**Two milestones:**

- **M1 — Functional ticketing without AI** (Phases 0–3): emails come in, become tickets, agents read/reply/send by hand.
- **M2 — Full AI-assisted MVP** (Phases 4–5): the human-in-the-loop draft loop with RAG + classification + summaries. This is the core product value.

Phases 6–7 are admin tooling, metrics, and production hardening.

---

## Phase 0 — Foundations

**Goal:** repo + tooling ready to build.

- [x] Monorepo layout: `web/` (Vite), `api/` (NestJS), `shared/` for Zod schemas + types
- [x] Scaffold NestJS app (`api/`); ESLint 10 (flat config) / Prettier / tsconfig — _all three workspaces lint clean (`npm run lint`)_
- [x] Scaffold Vite + React app (`web/`); Tailwind v4 + shadcn/ui (new-york) init
- [x] Neon Postgres with `pgvector` extension enabled; connection strings in `.env`
- [x] Prisma 7 init in `api/` (`prisma.config.ts`, `prisma-client` generator + pg driver adapter); baseline migration applied
- [x] Shared Zod schema package (Ticket, User, KB shapes); consumed by `web`, wired into `api` from Phase 1+
- [x] `.env.example` files (api + web); default branch is `local` — _GitHub branch-protection is a remote repo setting (enable in GitHub → Branches, or defer to Phase 7)_

---

## Phase 1 — Data model & Auth

**Goal:** schema and auth backbone both apps depend on.

- [ ] Prisma schema: Better Auth tables (`user`, `session`, `account`, `verification`) + app models (`Ticket`, `Message`, `KbArticle`, `KbChunk`, `Draft`, `AuditLog`)
- [ ] Ticket fields: `status`, `category`, `priority`, `requesterEmail`, threading fields (`messageId`, `inReplyTo`, `references`)
- [ ] `KbChunk` with `pgvector` embedding column
- [ ] Better Auth setup: `@thallesp/nestjs-better-auth`, Prisma adapter, roles plugin → Admin/Agent
- [ ] Bootstrap admin seed script; agent create/disable flows (admin only)
- [ ] Auth guards + role-based authorization on endpoints
- [ ] Frontend: login page, session hook, protected routes, role-based UI gating

**Deliverable:** can log in as admin/agent; full schema migrated.

---

## Phase 2 — Core ticketing (manual baseline, no AI)

**Goal:** agents can work tickets end-to-end by hand.

_Backend (`api/`):_

- [ ] Tickets module: read / list (filter by status/category/priority/assignee, sort, paginate)
- [ ] Messages module: thread per ticket
- [ ] Status transitions including **AwaitingStudent** + reopen rules
- [ ] Resend outbound service: send an agent reply as email

_Frontend (`web/`):_

- [ ] Dashboard layout (sidebar, header) with shadcn/ui
- [ ] Ticket list view (filters, sorting, pagination) via API client → Zustand
- [ ] Ticket detail view (message thread + metadata)
- [ ] Manual reply composer (textarea → send → outbound email + status → AwaitingStudent)
- [ ] Inline edits for status / category / priority

**🚩 Milestone M1 — working manual ticket system.**

---

## Phase 3 — Email inbound → tickets

**Goal:** support emails auto-create tickets; replies thread correctly.

- [ ] Resend inbound webhook endpoint (POST); verify Svix signature; idempotency by `Message-ID`
- [ ] Parse inbound email → create Ticket + first Message; store requester email
- [ ] Threading: match on `In-Reply-To` / `References`; fallback reconciliation (same requester + subject within a time window) with manual merge
- [ ] Spam / out-of-scope handling (status or category bucket; basic filtering)
- [ ] Reopen-on-reply: student reply to AwaitingStudent/Resolved/Closed → back to Open
- [ ] Attachments: capture + store (object storage), link to message

**Deliverable:** emails flow in and become worked tickets; replies round-trip to students.

---

## Phase 4 — Knowledge base & RAG

**Goal:** KB articles chunked, embedded, and retrievable for grounding drafts.

- [ ] KbArticle CRUD (admin authors/edits), lightweight versioning
- [ ] Chunking + embedding pipeline: on article save → chunk → Zhipu `embedding-3` → store vector in `KbChunk`
- [ ] Retrieval endpoint: query text → embed → top-k chunks (cosine similarity)
- [ ] Admin KB management UI (list / edit / publish)
- [ ] Re-embed on article update; clean up on delete

**Deliverable:** KB exists, retrieval works, ready to ground drafts.

---

## Phase 5 — AI drafts, classification, summaries (the AI core)

**Goal:** AI-assisted human-in-the-loop drafting — the product's core value.

- [ ] GLM client wrapper (Zhipu OpenAI-compatible endpoint; config for GLM 5.2 + the Flash-tier model)
- [x] **pg-boss** job queue setup (reuses Postgres, no Redis); `on Ticket created` → enqueue classify job — _see `api/src/queue/` + `ClassifyTicketConsumer`_
- [x] **Classify** job (Flash-tier GLM): **category** → write to ticket — _durable + retried; priority/spam-flag still TODO_
- [ ] **Summarize** job (Flash-tier GLM): thread summary
- [ ] **Draft** job (GLM 5.2): retrieve KB chunks (RAG) → grounded draft **with citations** to source chunks
- [ ] Draft UI: show draft + cited sources + classification + summary; edit-in-place; **Send** (→ outbound + AwaitingStudent) and **Regenerate**
- [ ] Feedback capture: accept / edit-distance / reject → logged for metrics
- [ ] Low-confidence handling: if no KB match, surface "no relevant article" instead of hallucinating, and flag the KB gap

**🚩 Milestone M2 — full AI-assisted MVP (the thin-slice goal).**

---

## Phase 6 — Dashboard, user management & metrics

**Goal:** admin tooling and visibility.

- [ ] Admin user management UI (create/disable agents, assign category/skill for routing)
- [ ] Routing rules: category/priority → assignee (rule-based)
- [ ] Dashboard metrics: ticket volume, draft-acceptance rate, avg time-to-send, category breakdown, KB-gap flags
- [ ] Auto-close: Resolved → Closed after N days of silence (scheduled pg-boss job)
- [ ] Global search across tickets / messages
- [ ] Notifications (new ticket, assigned to me)

---

## Phase 7 — Hardening & production deploy

**Goal:** production-ready.

- [ ] Frontend deploy (Vercel); backend deploy (Railway); production Neon DB
- [ ] DNS: SPF / DKIM / DMARC for the Resend sending domain; verify deliverability
- [ ] Security review: webhook signature checks, authz on every endpoint, CORS allowlist, Zod input validation, rate limiting, secrets management
- [ ] Observability: structured logging, error tracking (Sentry), pg-boss job dashboards, LLM cost/token logging
- [ ] Backups + retention policy; PII handling (ties to FERPA if applicable)
- [ ] Tests: unit (services), integration (API), E2E (critical flow: inbound → ticket → draft → send)
- [ ] Load sanity at hundreds/day; queue and cost monitoring

---

## Assumptions baked in (confirm or change before we start)

These resolve the open gaps from scoping so the plan is buildable. Flag any you want different:

- **Statuses:** Open, **AwaitingStudent**, Resolved, Closed — added _AwaitingStudent_ (the gap I flagged earlier; it's the most-used state once agents send replies).
- **Priority** is its own field (Low/Normal/High), separate from category.
- **Spam / out-of-scope** handled as a status or category bucket.
- **Drafts are generated lazily** (when a ticket is opened) via pg-boss, not eagerly on every arrival — cost control at hundreds/day.
- **Routing** is rule-based (category/priority → assignee), added in Phase 6.
- **Attachments** are captured in Phase 3; **multimodal AI** (reading screenshots) is deferred unless you want it earlier.
- **Compliance** (e.g. FERPA) is touched in Phase 7 — move earlier if it shapes data handling.

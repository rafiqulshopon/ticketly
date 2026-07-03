# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Ticketly — single-service production image.
#
# The NestJS API also serves the compiled SPA (one origin → Better Auth session
# cookies ride same-origin, no CORS/SameSite config to tune). The Postgres DB
# (pgvector) stays external on Neon; Railway only hosts this app and connects
# via DATABASE_URL.
#
# Build ordering is fixed by the monorepo: shared → prisma generate → api → web.
# shared is compiled INTO both bundles (build-time only); the Prisma client is
# gitignored and generated at build time; web/dist is copied to api/public so
# @nestjs/serve-static can serve it (see api/src/app.module.ts).
# ─────────────────────────────────────────────────────────────────────────────

# ── deps: install the full workspace tree (cached across source changes) ─────
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/
COPY shared/package.json ./shared/
RUN npm ci

# ── build: compile shared + api + web, generate the Prisma client ────────────
FROM deps AS build
COPY shared/ ./shared/
COPY api/ ./api/
COPY web/ ./web/
RUN npm run build --workspace @ticketly/shared \
 && npm run db:generate \
 && npm run build --workspace @ticketly/api \
 && npm run build --workspace @ticketly/web
# Serve the SPA from the API's origin (single-origin deploy).
RUN cp -r web/dist api/public

# ── runtime: lean prod deps + built artifacts ────────────────────────────────
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Prod-only deps (hoisted to /app/node_modules) + workspace symlinks. `prisma`
# is a runtime dep of the api so `migrate deploy` is available here (it's a
# devDep-only omission that would otherwise drop the CLI).
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/
COPY shared/package.json ./shared/
RUN npm ci --omit=dev

# Built artifacts that aren't produced by a fresh prod install.
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/api/dist ./api/dist
COPY --from=build /app/api/public ./api/public
COPY --from=build /app/api/prisma ./api/prisma
COPY --from=build /app/api/prisma.config.ts ./api/prisma.config.ts
# Flat-file knowledge base read at runtime by ai/knowledge-base.service.ts via
# readFileSync(resolve(cwd, "knowledge-base.md")). It's not compiled into dist
# (nest-cli.json has no assets), so ship it explicitly — without it the AI
# auto-resolve throws ENOENT and silently leaves tickets in OPEN with no reply.
COPY --from=build /app/api/knowledge-base.md ./api/knowledge-base.md

WORKDIR /app/api
EXPOSE 3000
# Apply pending migrations (idempotent) then start. Uses the runtime
# DATABASE_URL; single replica → no migrate race. PORT is injected by Railway.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

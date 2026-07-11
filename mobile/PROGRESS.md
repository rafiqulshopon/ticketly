# Mobile app — progress tracker

Detailed progress for `@ticketly/mobile` (Expo SDK 57 + React Native 0.86). The
root [implementation-plan.md](../implementation-plan.md) holds the one-line
milestone view; **this file is the granular tracker** — what's built, what's
next, and the decisions worth not losing. Conventions live in the root
[CLAUDE.md](../CLAUDE.md).

**Last updated:** 2026-07-11 · **Current milestone:** M0 ✅ complete → M1 next

---

## M0 — Foundations & auth ✅ COMPLETE

Verified 2026-07-11: `tsc --noEmit` (api + web + mobile), `eslint . --max-warnings 0`
(mobile), and `npx expo export --platform ios` (1924 modules) all pass.

### What was built

**Server-side auth unlock** (the one change outside `mobile/` — RN has no browser
cookie jar, so the API had to learn the Expo client):

- [api/src/auth/auth.config.ts](../api/src/auth/auth.config.ts) — added the `expo()` plugin + the `ticketly://` scheme to `trustedOrigins` (+ `exp://` wildcards in dev). Web is unaffected (cookies still work alongside it).
- [api/package.json](../api/package.json) — added `@better-auth/expo`.

**Mobile workspace (`mobile/`):**

- [package.json](./package.json) — `@ticketly/mobile`; Expo SDK 57, RN 0.86, React 19.2, NativeWind v4, Tailwind v3, better-auth + `@better-auth/expo`, axios, `@tanstack/react-query`, `react-native-sse`, `react-native-toast-message`, `react-hook-form`, zod.
- [app.json](./app.json) — scheme `ticketly`, `typedRoutes: false`, React Compiler on.
- Configs: [tsconfig.json](./tsconfig.json), [babel.config.js](./babel.config.js) (`jsxImportSource: "nativewind"`), [metro.config.js](./metro.config.js) (`withNativeWind` + `@ticketly/shared`→source alias + `watchFolders`), [tailwind.config.js](./tailwind.config.js), [src/global.css](./src/global.css) (Signal tokens ported from `web/src/index.css`), [nativewind-env.d.ts](./nativewind-env.d.ts), [eslint.config.mjs](./eslint.config.mjs), [.env.example](./.env.example).
- Core lib: [src/lib/auth.ts](./src/lib/auth.ts) (better-auth/react client + `expoClient`/SecureStore + `isAdmin()`), [src/lib/api.ts](./src/lib/api.ts) (axios + Cookie interceptor + `ApiError` + all endpoints, ported from web), [src/lib/format.ts](./src/lib/format.ts), [src/lib/query-client.ts](./src/lib/query-client.ts).
- Realtime: [src/hooks/use-realtime-events.ts](./src/hooks/use-realtime-events.ts) — SSE via `react-native-sse` + Cookie header (ported from the web hook; same Query keys).
- App shell: [src/app/_layout.tsx](./src/app/_layout.tsx) (root: QueryClient + Toast + Stack), [src/app/(auth)/_layout.tsx](<./src/app/(auth)/_layout.tsx>) + [login.tsx](<./src/app/(auth)/login.tsx>), [src/app/(app)/_layout.tsx](<./src/app/(app)/_layout.tsx>) (authed tab shell + SSE mount + admin-tab gating) + [index.tsx](<./src/app/(app)/index.tsx>) (RoleRedirect).
- Smoke-test screens (prove auth + shared + query wiring): [tickets/index.tsx](<./src/app/(app)/tickets/index.tsx>) + [tickets/[id].tsx](<./src/app/(app)/tickets/[id].tsx>). Stubs: [dashboard.tsx](<./src/app/(app)/dashboard.tsx>), [users.tsx](<./src/app/(app)/users.tsx>), [notifications.tsx](<./src/app/(app)/notifications.tsx>).

**Repo config + docs:**

- root [package.json](../package.json) (`mobile` workspace + `dev:mobile`), [.gitignore](../.gitignore) + [.dockerignore](../.dockerignore) (mobile excluded from the Docker image).
- [CLAUDE.md](../CLAUDE.md) (Mobile section), [tech-stack.md](../tech-stack.md), [README.md](../README.md), [.claude/agents/security-reviewer.md](../.claude/agents/security-reviewer.md) (mobile scope + RN security checklist).

### Decisions worth not losing

- **Expo SDK 57** (RN 0.86, React 19.2) — `npm view expo` returned `57.0.4` as `latest` at build time (SDK 57 had graduated from canary). RN 0.86 has no breaking changes vs 0.85; React 19.2 still matches the web.
- **NativeWind v4.2.6** (Tailwind v3) — the *stable* release; v5 is `5.0.0-preview.4` only (not on the `latest` dist-tag). Token **values** are identical to the web; only the config mechanism differs (v3 `@tailwind` directives + `theme.extend.colors` mapped to CSS vars vs. the web's v4 `@theme inline`).
- **Tailwind v3 is nested under `mobile/node_modules`; the web stays on v4** — npm hoists v3 to root and nests v4 in `web/`. The VS Code Tailwind extension may show false-positive v4 errors on `mobile/src/global.css` (it resolves the web's Tailwind); the build is correct.
- **`authClient.getCookie()` is synchronous** — cached in memory by the `expoClient` plugin after the initial SecureStore load. The axios interceptor `await`s it defensively (works whether it returns a string or a Promise).
- **`@ticketly/shared` resolves to TS source** in dev ([metro.config.js](./metro.config.js) `extraNodeModules` + `watchFolders`) — hot-reloads, and avoids the CJS `dist` "does not provide an export named" gotcha. (shared/dist also exists as a fallback.)
- **React Native 0.86 has native `className`** — `@types/react-native` declares it, so NativeWind's type augmentation isn't needed; the only declaration required is `declare module "*.css"` in [nativewind-env.d.ts](./nativewind-env.d.ts) (NativeWind v4.2.6 ships no `*.css` declaration and `nativewind/types` is a silent no-op).
- **react-native-sse `EventSource<E>`** defaults its generic to `never` — pass the explicit generic (`new EventSource<RealtimeSseEvent>(...)`) so `addEventListener` accepts the custom SSE event names.

### Known gaps / flagged (not blocking M1)

- Pre-existing: `api/eslint-rules/require-auth-decision.mjs` is missing → `npm run lint` on the api workspace throws. Unrelated to mobile.
- Pre-existing: `tech-stack.md` "Infrastructure & deploy" still says "Vercel + Railway, separate origins" (reality: single-origin Railway).
- Unused template assets in `mobile/assets/images/` (expo-badge, react-logo, tabIcons, tutorial-web) — harmless; prune in M4.
- `mobile/.vscode/` is gitignored local editor config (left as-is).
- **No Jest setup yet** — deferred to M1 (first component test).

---

## M1 — Tickets ⬜ NEXT

- [ ] Tickets list: debounced search (300ms)
- [ ] Tickets list: server-side sort UI (`sortBy` / `sortDir`)
- [ ] Tickets list: filters (status / category / priority / assignee)
- [ ] Tickets list: pagination (`page` / `pageSize`, `keepPreviousData`)
- [ ] Tickets list: role-aware statuses (agents hide `NEW` / `PROCESSING`)
- [ ] Ticket detail: message thread + smooth auto-scroll
- [ ] Ticket detail: reply form (optimistic via `useOptimistic` + `replyToTicket`)
- [ ] Ticket detail: AI polish (`polishReply`)
- [ ] Ticket detail: AI summarize (`summarizeTicket`)
- [ ] Ticket detail: inline property edits (status / priority / category / assignee)
- [ ] Ticket detail: Activity tab (`getTicketActivity`)
- [ ] Realtime SSE wired into the detail page (live message append + activity prepend)
- [ ] Ticket-badges component (status/priority → semantic colors; port from `web/src/components/tickets/ticket-badges.ts`)
- [ ] Replace the tickets list/detail smoke-tests with the full UI
- [ ] Jest + `@testing-library/react-native` setup + first component test

## M2 — Notifications & shell ⬜

- [ ] Notification bell (poll `unread-count` every 30s)
- [ ] Realtime invalidation of notifications on SSE events
- [ ] Mark single / mark-all read
- [ ] Full notifications feed screen (replace stub)
- [ ] Bottom-tab shell polish + `RoleRedirect` verified

## M3 — Admin ⬜

- [ ] Dashboard: stat cards (`getDashboardStats`)
- [ ] Dashboard: tickets-per-day bar chart (`victory-native`)
- [ ] Users: list (`getUsers`) with search + paginate
- [ ] Users: create/edit (`react-hook-form` + zod)
- [ ] Users: delete (confirm dialog)

## M4 — Hardening ⬜

- [ ] Sentry (`@sentry/react-native`) init + `ErrorBoundary`
- [ ] Consistent loading / empty / error states across screens
- [ ] Pull-to-refresh on lists
- [ ] `expo-updates` OTA + `eas.json` (dev / preview / production)
- [ ] Prune unused template assets

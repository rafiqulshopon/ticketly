# Mobile app — progress tracker

Detailed progress for `@ticketly/mobile` (Expo SDK 57 + React Native 0.86). The
root [implementation-plan.md](../implementation-plan.md) holds the one-line
milestone view; **this file is the granular tracker** — what's built, what's
next, and the decisions worth not losing. Conventions live in the root
[CLAUDE.md](../CLAUDE.md).

**Last updated:** 2026-07-11 · **Current milestone:** M2 ✅ complete → M3 next

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

## M1 — Tickets ✅ COMPLETE

Verified 2026-07-11: `tsc --noEmit` (mobile), `eslint . --max-warnings 0` (mobile),
`jest` (6/6), and `npx expo export --platform ios` (3836 modules) all pass.

- [x] Tickets list: debounced search (300ms)
- [x] Tickets list: server-side sort UI (`sortBy` / `sortDir`)
- [x] Tickets list: filters (status / category / priority / assignee)
- [x] Tickets list: pagination (`page` / `pageSize`, `keepPreviousData`)
- [x] Tickets list: role-aware statuses (agents hide `NEW` / `PROCESSING`)
- [x] Ticket detail: message thread + smooth auto-scroll
- [x] Ticket detail: reply form (optimistic via `useOptimistic` + `replyToTicket`)
- [x] Ticket detail: AI polish (`polishReply`)
- [x] Ticket detail: AI summarize (`summarizeTicket`)
- [x] Ticket detail: inline property edits (status / priority / category / assignee)
- [x] Ticket detail: Activity tab (`getTicketActivity`)
- [x] Realtime SSE wired into the detail page (live message append + activity prepend)
- [x] Ticket-badges component (status/priority → semantic colors; port from `web/src/components/tickets/ticket-badges.ts`)
- [x] Replace the tickets list/detail smoke-tests with the full UI
- [x] Jest + `@testing-library/react-native` setup + first component test

### What was built

All a UI/feature build on the M0 infra (every endpoint + the SSE hook already
existed) — no new API plumbing.

- **UI primitives** — [src/components/ui/](./src/components/ui/): `Badge`, `Button`, `Card`(+Header/Title/Content), `Avatar`, `Segmented`, `Field`/`TextField`, a bottom-sheet `Select` (RN has no Radix). Plus [src/lib/cx.ts](./src/lib/cx.ts) (the NativeWind `cn`) and [src/lib/colors.ts](./src/lib/colors.ts) (`useIconColor` — lucide's `color` prop needs a literal, so this mirrors the tokens per color scheme).
- **Tickets feature components** — [src/components/tickets/](./src/components/tickets/): `ticket-badges.ts` (port), `ticket-messages.tsx` (thread + smooth `scrollToEnd`), `reply-form.tsx` (optimistic + AI polish), `ticket-summary.tsx` (AI summarize), `property-select.tsx` + `assignee-select.tsx` (inline edits), `ticket-activity.tsx`, `ticket-properties.tsx`.
- **Screen rewrites** — [tickets/index.tsx](<./src/app/(app)/tickets/index.tsx>) (debounced search, server sort/filter/paginate, role-aware statuses, `keepPreviousData`), [tickets/[id].tsx](<./src/app/(app)/tickets/[id].tsx>) (Conversation/Activity/Properties tabs, `useOptimistic` lifted, `KeyboardAvoidingView`).
- **Tests** — [jest.config.js](./jest.config.js) (`jest-expo` preset), [jest.setup.ts](./jest.setup.ts), and the first test [ticket-badges.test.ts](./src/components/tickets/ticket-badges.test.ts) (6 assertions).
- **Tokens** — added soft semantic backgrounds (`--*-soft`) to [src/global.css](./src/global.css) + [tailwind.config.js](./tailwind.config.js) so the Badge variants are tinted without relying on NativeWind's `/opacity`-on-CSS-var behavior.

### Decisions worth not losing

- **Detail layout = 3 tabs (Conversation / Activity / Properties)**, not the web's 2-column thread + sticky sidebar. The in-content header replaces the hidden route header (the Tickets tab has no stack back affordance). The reply form is pinned at the bottom of the Conversation tab with `KeyboardAvoidingView`.
- **Select = bottom sheet** via `react-native-modal` (^14.0.0-rc.1 — Expo's `expo install` picked the RC; downgrade to 13.x if it misbehaves in M2). One component reused for every list filter and every inline property edit; sentinel `__none__` → null.
- **Soft badge tokens, not `/opacity`** — NativeWind's opacity modifier over CSS-var colors is unreliable, so the semantic Badge variants use explicit `--*-soft` bg + `-*-fg` text tokens (values identical to the web's `/10` tints).
- **`crypto.randomUUID()` doesn't exist in Hermes** — the optimistic message id is `optimistic-${Date.now()}-${Math.random()…}`.
- **M1 #12 (SSE into detail) was already done in M0** — `use-realtime-events.ts` appends `new_message` into `["ticket", id]` and prepends `ticket_activity` into `["ticket-activity", id]` when the user is on that detail screen; M1 just kept the cache keys aligned.
- **Test files need `/// <reference types="jest" />`** — `@types/jest` globals don't auto-surface under the Expo tsconfig base, so each `*.test.ts` carries the triple-slash directive.

### Known gaps / flagged (not blocking M2)

- **No manual device run yet** — all four build gates pass, but the flow hasn't been driven on a simulator/device end-to-end (reply, polish, summarize, inline edits, live SSE). Do this before M2.
- Loading/empty/error states are minimal text (M4 hardening will unify them); the list has no pull-to-refresh (M4).
- `react-native-modal ^14.0.0-rc.1` is an RC — watch for regressions.

## M2 — Notifications & shell ✅ COMPLETE

Verified 2026-07-11: `tsc --noEmit` (mobile), `eslint . --max-warnings 0` (mobile),
`jest` (10/10), and `npx expo export --platform ios` all pass.

- [x] Notification bell — a live unread-count `tabBarBadge` on the Notifications tab (polled every 30s)
- [x] Realtime invalidation of notifications on SSE events (list + count keys)
- [x] Mark single / mark-all read
- [x] Full notifications feed screen (replaced the M0 stub)
- [x] Bottom-tab shell polish (icons on every tab) + `RoleRedirect` verified

### What was built

A UI build on the M0/M1 data layer — every notification endpoint, the mobile API
client, the shared `Notification`/`UnreadCount` schemas, and the SSE mount already
existed. No backend changes.

- **Unread-count hook** — [src/hooks/use-notifications.ts](./src/hooks/use-notifications.ts): `useUnreadNotificationCount()` polls `GET /api/notifications/unread-count` every 30s (`refetchInterval`), returns `data?.count ?? 0`. Mounted in `(app)/_layout` so the badge updates on every tab.
- **Tab shell + badge** — [src/app/(app)/_layout.tsx](<./src/app/(app)/_layout.tsx>): `tabBarIcon` on all five tabs via `lucide-react-native` (Inbox / LayoutDashboard / Users / Bell); `tabBarActiveTintColor`/`tabBarInactiveTintColor` from `useIconColor("primary")`/`("muted")`; the Notifications tab carries `tabBarBadge: unread || undefined`. Renamed the tab "Alerts" → "Notifications". All hooks run before the `isPending`/`!session` early returns (Rules of Hooks).
- **Notification row** — [src/components/notifications/notification-item.tsx](./src/components/notifications/notification-item.tsx): `NotificationItem` + co-located `NOTIFICATION_META` (object map, not a switch). Ports the web's row layout: tinted icon chip (`bg-info-soft`/`bg-muted`), label + `bg-destructive` unread dot, subject, `requesterName · relativeTime`. Unread rows get `bg-accent` (no `accent-soft` token exists; `bg-accent` vs `bg-card` is the unread signal). Icon stroke via `useIconColor(isUnread ? "info" : "muted")`.
- **Feed screen** — [src/app/(app)/notifications.tsx](<./src/app/(app)/notifications.tsx>): replaced the 12-line stub. `FlatList` of `NotificationItem`; `ListHeaderComponent` (title + unread count + "Mark all read"); `ListEmptyComponent` ("You're all caught up."); loading → `ActivityIndicator`; error → `text-destructive` + "Try again". Row press navigates to `/tickets/${n.ticketId}` + fires `markNotificationRead` (non-fatal, skipped if read). `refresh()` invalidates both `["notifications"]` and `["notifications","unread-count"]`.
- **Realtime hook** — [src/hooks/use-realtime-events.ts](./src/hooks/use-realtime-events.ts): added explicit `["notifications","unread-count"]` invalidation alongside `["notifications"]` in the `new_message` + `new_ticket` handlers (prefix matching already covered it; explicit mirrors the web's `refresh()`).
- **RoleRedirect** — [src/app/(app)/index.tsx](<./src/app/(app)/index.tsx>): verified (admin→dashboard, agent→tickets; `index` hidden via `href: null`); added a comment documenting why no `isPending` guard is needed (the layout gates it).
- **Test** — [src/components/notifications/notification-item.test.tsx](./src/components/notifications/notification-item.test.tsx): 4 assertions (meta completeness + labels + render of label/subject/requester + unread-dot presence). `.tsx` (renders JSX); stubs `lucide-react-native` (its ESM isn't jest-transformed) and `await`s `render` (`@testing-library/react-native` v13 returns a Promise).

### Decisions worth not losing

- **The "bell" is a tab badge, not a header component** — a `Bell` tab icon with a live `tabBarBadge`. Always visible from any tab; unifies with the tab-polish deliverable. Chosen over a header bell (web-style), which would only show on screens with a header and need per-screen mounting.
- **`tabBarBadge` updates on re-render** — `_layout.tsx` mounts `useUnreadNotificationCount()`, so when the polled/SSE-invalidated count changes the layout re-renders and the badge updates. No `navigation.setOptions` dance needed.
- **No `accent-soft` token** — unread rows use `bg-accent` (`#f1f4f8`) vs `bg-card` (`#ffffff`); the unread dot + bold label + tinted icon chip carry the rest of the signal. A soft-accent token can be added in M4 if the tint is too subtle.
- **`ticket_assigned` notifications have no SSE event** — the backend emits only `new_message`/`new_ticket`/`ticket_activity`/`ping`. The badge refreshes on the next 30s poll (same gap as the web). Not fixed in M2 (would need a backend `notification` SSE event).
- **lucide mock in tests** — `jest.mock("lucide-react-native", …)` stubs icons to `() => null`; the package's ESM (`dist/esm/*.mjs`) isn't transformed by jest-expo. Mock lives in the test file (not `jest.setup.ts`) since `jest.mock` is per-file-hoisted and only this test renders icons so far.
- **`render` is async** — `@testing-library/react-native` v13's `render` returns a `Promise<RenderAPI>` (React 19 `act`), so render tests `await render(...)`.

### Known gaps / flagged (not blocking M3)

- **No manual device run yet** — all four build gates pass, but the flow hasn't been driven on a simulator/device end-to-end (badge poll, realtime bump, mark-read, mark-all). Do this before M3. (M1's manual run is also still pending.)
- **In-screen admin guards on `dashboard.tsx`/`users.tsx` deferred to M3** — tab hiding (`href: null`) ≠ route guard; an agent deep-linking to `/(app)/dashboard` would still render the stub. Harmless today (stubs render nothing sensitive); add `isAdmin` redirects when those screens are built in M3.
- **Cold-launch edge** — `useUnreadNotificationCount` mounts in `_layout` during `isPending`, so its first fetch may 401 before the session cookie loads. Silent (no retry on `ApiError`); self-heals via the 30s poll / SSE invalidation / tab switch. Gate on session in a later pass if it matters.

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

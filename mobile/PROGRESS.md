# Mobile app — progress tracker

Detailed progress for `@ticketly/mobile` (Expo SDK 57 + React Native 0.86). The
root [implementation-plan.md](../implementation-plan.md) holds the one-line
milestone view; **this file is the granular tracker** — what's built, what's
next, and the decisions worth not losing. Conventions live in the root
[CLAUDE.md](../CLAUDE.md).

**Last updated:** 2026-07-12 · **Current milestone:** M4 ✅ complete → mobile parity 🎉

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

## M3 — Admin ✅ COMPLETE

Verified 2026-07-12: `tsc --noEmit` (mobile), `eslint . --max-warnings 0` (mobile),
`jest` (13/13), and `npx expo export --platform ios` (4627 modules — victory-native + Skia
resolved cleanly) all pass.

- [x] Dashboard: stat cards (`getDashboardStats`)
- [x] Dashboard: tickets-per-day bar chart (`victory-native`)
- [x] Users: list (`getUsers`) with search + paginate
- [x] Users: create/edit (`react-hook-form` + zod)
- [x] Users: delete (confirm dialog)
- [x] Carryover: in-screen `isAdmin` guards kept on `dashboard.tsx`/`users.tsx` (stubs replaced with guarded screens)
- [x] Dashboard stat-card deep-links (`/tickets?view=…`) wired into the M1 tickets screen

### What was built

A UI build on the existing data layer — `getDashboardStats`, `getUsers`, `createUser`, `updateUser`, `deleteUser` were already wired in [src/lib/api.ts](./src/lib/api.ts) and the shared `DashboardStats`/`UserListItem`/`createUserSchema`/`editUserSchema` schemas already importable. No backend, shared-package, or web changes.

- **Dashboard** — [src/app/(app)/dashboard.tsx](<./src/app/(app)/dashboard.tsx>): `useQuery(["dashboard","stats"], getDashboardStats)` + ApiError-aware retry + AbortSignal; loading → `ActivityIndicator`, error → `text-destructive` + "Try again". Five stat cards in a 2-column layout, then the chart.
- **Stat card** — [src/components/dashboard/stat-card.tsx](./src/components/dashboard/stat-card.tsx): `Pressable`→`Card`, icon chip (`bg-secondary` / `bg-ai-soft` for AI tone), `flex-1` so cards fill the row. Tapping navigates to `/tickets?view=…` (Total→all, Open→open, Resolved by AI→resolvedByAi; AI rate + avg resolution time are non-interactive).
- **Chart** — [src/components/dashboard/tickets-per-day-chart.tsx](./src/components/dashboard/tickets-per-day-chart.tsx): victory-native `CartesianChart` + `Bar` port of the web's recharts chart. Token colors via `useIconColor` (Skia needs concrete hex); axis labels via `matchFont({ fontSize: 11 })` (system font, no bundled TTF). Y domain pinned `[0, max]` (web's `allowDecimals={false}`); static for v1 (no press tooltip).
- **Users** — [src/app/(app)/users.tsx](<./src/app/(app)/users.tsx>): debounced search (300 ms) + paginated `FlatList` (`PAGE_SIZE=20`, `keepPreviousData`); pager footer (Prev/Next + "Page X of Y"); create/edit/delete via three modals.
- **User row** — [src/components/users/user-row.tsx](./src/components/users/user-row.tsx): avatar+initials, name, email, role Badge (admin/agent), status Badge (banned/active), joined date; edit + delete actions (delete disabled for admins).
- **User form** — [src/components/users/user-form.tsx](./src/components/users/user-form.tsx): one `mode: "create" | "edit"` component, RHF + zodResolver (`createUserSchema`/`editUserSchema`) with `<Controller>` per field (RN has no `register`); closes on success only, surfaces 409/404/403/400; success toast.
- **Delete confirm** — [src/components/users/delete-user-confirm.tsx](./src/components/users/delete-user-confirm.tsx): destructive `Button variant="destructive"`; 400 → "Admins cannot be deleted."; invalidates `["users"]`; success toast.
- **Modal primitive** — [src/components/ui/modal.tsx](./src/components/ui/modal.tsx): centered `react-native-modal` (not a bottom sheet) with optional `KeyboardAvoidingView` (`avoidKeyboard`) for forms; serves both dialogs. Exported from the ui barrel. The `Select` keeps its own bottom sheet.
- **Button destructive variant** — [src/components/ui/button.tsx](./src/components/ui/button.tsx): added `destructive` (`bg-destructive` / `text-destructive-foreground`) — mirrors the web.
- **Tickets deep-link** — [src/app/(app)/tickets/index.tsx](<./src/app/(app)/tickets/index.tsx>): reads `view` from `useLocalSearchParams`, passes it to `getTickets`, resets to page 1 when it changes (render-time "previous value" pattern — not an effect, to satisfy `set-state-in-effect`), suppresses the manual `status` filter while a view is active, and shows a dismissible "Showing: …" chip.
- **Test** — [src/components/users/user-row.test.tsx](./src/components/users/user-row.test.tsx): 3 assertions (renders name/email/role/status; admin delete disabled + agent enabled; banned → "Banned"). Stubs `lucide-react-native`.

### Decisions worth not losing

- **Chart lib = `victory-native` (per plan)** — considered a zero-dep View-based bar chart (Skia is heavy and carries a live Skia-v2 / RN-0.86 compatibility risk, issue #616); the plan names victory-native and the user confirmed. Installed via `npx expo install victory-native @shopify/react-native-skia` (NOT bare npm — ERESOLVE on the Skia peer); resolved to victory-native ^41.26.0 + Skia 2.6.2. `reanimated` / `gesture-handler` already present; no d3 deps (victory-native bundles them).
- **`matchFont` for axis labels** — Skia axis labels need a `SkFont`; `matchFont({ fontSize: 11 })` returns the system font (no TTF bundle). The font line is isolated so the fallback (bundled TTF via `useFont`, or bars-only + RN `<Text>` ticks) is a one-line swap if `matchFont` misbehaves on a device.
- **Centered modal, not a bottom sheet** — the user form has three `TextInput`s; a bottom sheet fights the keyboard. A centered modal in a `KeyboardAvoidingView` lifts cleanly and matches the web's `Dialog`.
- **Stat-card deep-links use a `view` query param** — the mobile tickets screen used local filter state and ignored `view`; M3 wires it (`getTickets` already accepted `view`). While a view is active the manual `status` filter is suppressed (the server ignores `view` once `status` is set) and a dismissible chip explains the override.
- **Page reset on `view` change uses the render-time "previous value" pattern** — `react-hooks/set-state-in-effect` (eslint-plugin-react-hooks v7) flags synchronous `setState` in an effect; the React-endorsed `if (view !== prevView) { setPrevView(view); setPage(1); }` during render satisfies it.
- **No role picker** — `createUserSchema` / `editUserSchema` have no role field; new users join as agents (server default). Mirrors the web exactly.
- **`disabled` isn't exposed on a `Pressable` host view** — tests assert `accessibilityState.disabled` (set explicitly), not `props.disabled`.

### Known gaps / flagged (not blocking M4)

- **No manual device run yet** — all four build gates pass, but the dashboard chart, stat-card deep-links, and user CRUD haven't been driven on a simulator end-to-end. Skia's first native build is long (~10 min, New Arch). Do this before M4. (M1/M2 manual runs are also still pending.)
- **Skia axis-label font unverified on-device** — `matchFont` returns the system font; confirm labels render on iOS/Android. Fallbacks documented in the chart component.
- **Long first native build** — adding Skia means the first `expo run:ios` / EAS build compiles Skia (~10 min, large prebuild). Expectation only.

## M4 — Hardening ✅ COMPLETE

Verified 2026-07-12: `tsc --noEmit` (mobile), `eslint . --max-warnings 0` (mobile),
`jest` (27/27), and `npx expo export --platform ios` (Sentry SDK + expo-updates resolve)
all pass.

- [x] Sentry (`@sentry/react-native`) init + `ErrorBoundary`
- [x] Consistent loading / empty / error states across screens
- [x] Pull-to-refresh on lists
- [x] `expo-updates` OTA + `eas.json` (dev / preview / production)
- [x] Prune unused template assets

### What was built

- **Sentry (errors-only, no-op without a DSN)** — `@sentry/react-native ~7.11.0`
  via `npx expo install`. [src/lib/sentry.ts](./src/lib/sentry.ts) does
  `Sentry.init({ dsn: EXPO_PUBLIC_SENTRY_DSN, enabled: !!DSN, environment: __DEV__ ? "development" : "production" })`,
  mirroring `web/src/main.tsx` + `api/src/instrument.ts`. Imported as the FIRST line of
  [src/app/_layout.tsx](./src/app/_layout.tsx) (ahead of `global.css`). A dependency-free
  terminal fallback ([src/components/sentry-error-fallback.tsx](./src/components/sentry-error-fallback.tsx)
  — design tokens only, no hooks/router/queries) backs a root `<Sentry.ErrorBoundary>`
  wrapping the `<Stack>` (Toast stays outside it). `EXPO_PUBLIC_SENTRY_DSN` was already in
  `.env.example`. Build-time source-map upload is wired via the `@sentry/react-native/expo`
  config plugin in the new [app.config.ts](./app.config.ts) (auto-reads
  `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` at EAS Build).
- **Unified loading / empty / error states** — three shared primitives in
  [src/components/ui/](./src/components/ui/): `LoadingState`, `ErrorState`, `EmptyState`
  (exported from the ui barrel); plus [src/lib/errors.ts](./src/lib/errors.ts)
  `toErrorMessage(err, fallback)` — one `ApiError`-status map (401/403/404) replacing the
  three divergent per-screen strategies (raw `.message`; dashboard/users `toErrorMessage`;
  `toDetailErrorMessage`). All 5 data screens now use them; the redundant inline `retry:`
  predicates were dropped (the `QueryClient` default already covers them); `tickets/[id]`
  migrated `isLoading`→`isPending` and the missing `bg-background` on its error wrapper is
  fixed by `ErrorState`.
- **Pull-to-refresh** — `RefreshControl` (`refreshing={isFetching && !isPending}`;
  `onRefresh` → `refetch`, or the existing `refresh()` invalidator on notifications) on the
  tickets list, notifications feed, users list, and dashboard `ScrollView`. `RefreshControl`
  can't take `className`, so the spinner color is raw hex via `useIconColor("primary")` (the
  same token resolver the dashboard icons use). Notifications' `FlatList` also gained the
  `bg-background` it was missing.
- **expo-updates OTA + EAS Build profiles** — [app.config.ts](./app.config.ts) (function form
  over the static `app.json`) adds the `@sentry/react-native/expo` plugin, the `updates`
  block (`checkAutomatically: "ON_LOAD"`; URL + `extra.eas.projectId` are
  `REPLACE_WITH_PROJECT_ID` placeholders filled by `eas update:configure`), and
  `runtimeVersion: { policy: "fingerprint" }`. [eas.json](./eas.json) defines
  development / preview / production profiles with channels; production uses
  `autoIncrement`. Added `build:ios` + `update` npm scripts.
- **Asset prune** — removed 14 unused Expo template assets (expo/react badges + logos,
  `logo-glow`, `tutorial-web`, the whole `tabIcons/` dir); kept the 6 `app.json` references.

### Decisions worth not losing

- **Sentry setup is manual, not the `@sentry/wizard`** — keeps the repo's `enabled: !!DSN`
  no-op gating and a dependency-free, design-token fallback. Same shape as web + api.
- **`runtimeVersion.policy = "fingerprint"`** — auto-bumps the runtime version on any
  native/config change so an OTA bundle is only delivered to a matching binary
  (incompatible bundles are silently skipped by expo-updates). Cost: any native change
  forces a new EAS build before the next OTA lands.
- **`app.json` → `app.config.ts` (function form extending `app.json`)** — `app.json` stays
  the static source of truth; the config layers the Sentry plugin + updates + extra. Note:
  `ConfigContext`/`ExpoConfig` are imported from `"expo/config"` (NOT `@expo/config-types`,
  which dropped `ConfigContext` in SDK 57), and the merged object needs `as ExpoConfig`
  because the spread makes `name` `string | undefined`.
- **The Sentry *metro* wrapper was dropped** — `@sentry/react-native` v7 renamed `withSentry`
  → `withSentryConfig`, but wrapping the metro config crashes `expo export` with an opaque
  "Cannot read properties of undefined (reading 'match')" (in the always-on
  serializer/resolver — it fails even with all optional features off). The wrapper is NOT
  required: the SDK captures crashes, and source maps upload at EAS Build via the config
  plugin. See the comment block in [metro.config.js](./metro.config.js).
- **`refreshing = isFetching && !isPending`** (not `isPending` alone) — true on a background
  refetch (pull-to-refresh), false on the initial full-screen load; `isPending` alone would
  freeze the spinner during first paint.
- **`errors.test.ts` mocks `@/lib/auth`** — the test only needs the `ApiError` class from
  `@/lib/api`, but that module pulls in `@/lib/auth` → `better-auth/react` (ESM `.mjs` that
  jest-expo doesn't transform). A per-file `jest.mock("@/lib/auth", …)` breaks the chain
  (same pattern as the lucide mock in `notification-item.test`).

### Known gaps / flagged (post-M4 / device-only)

- **No manual device run yet** — all four build gates pass, but Sentry capture, the
  ErrorBoundary fallback, OTA, and PTR haven't been driven on a simulator/device. Sentry is
  only fully verifiable via a real EAS build with `SENTRY_AUTH_TOKEN` set (trigger a throw,
  confirm the event + readable stack). OTA needs `eas update --channel preview` then a relaunch.
- **External setup the code can only stub** — `EXPO_PUBLIC_SENTRY_DSN` in `.env`; the
  build-time `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` in EAS secrets/CI;
  `eas login` + `eas update:configure` (writes the real `projectId` + updates URL);
  `npx expo prebuild --clean` (expo-updates + @sentry/react-native add native code).
- **Sentry metro wrapper incompatible** — see "Decisions"; OTA symbolication relies on the
  build-time config plugin instead of in-band debug IDs. Revisit when @sentry/react-native /
  Expo SDK 57 realign.
- **fingerprint OTA skipping** — by design, a JS-only `eas update` after a native change
  without a rebuild is silently skipped. Documented for whoever ships updates.

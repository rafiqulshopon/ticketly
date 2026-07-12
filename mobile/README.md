# @ticketly/mobile

The Ticketly mobile app — **Expo SDK 57** (React Native 0.86, React 19.2) with
Expo Router and NativeWind v4. Consumes the same REST API as the web and reuses
`@ticketly/shared` Zod schemas.

## Run

```bash
# from repo root
npm run dev:mobile          # → npx expo start
#   press i (iOS sim), a (Android), or scan the QR with Expo Go
```

The API must be running (`npm run dev`) and `mobile/.env` must set
`EXPO_PUBLIC_API_URL` to a reachable origin (see `.env.example`):

- iOS simulator: `http://localhost:3000`
- physical device: `http://<your-dev-machine-LAN-IP>:3000`

## Build & install on a device (EAS Build)

Release/device builds run in **EAS's cloud** — no local Android Studio or Xcode,
no multi-GB SDK install. **Expo Go cannot load this app** (it depends on
`@shopify/react-native-skia`, which isn't in Expo Go), so you must build.

> ⚠️ **Run every EAS command from `mobile/`, never the repo root.** There's a
> stray root `eas.json`; building from `/ticketly` makes EAS resolve the JS entry
> against the repo root and fall back to `expo/AppEntry.js`, which fails importing
> a nonexistent root `App.js`. Always `cd mobile` first.

### Prerequisites (one-time)

```bash
npm install -g eas-cli        # the only local install (small Node CLI)
eas login                      # free expo.dev account
```

The EAS project is already linked (`expo.extra.eas.projectId` in
[app.json](./app.json)), so no `eas init` is needed on this repo. If you fork or
rename, re-link with `eas init`.

### Android — installable APK (`preview` profile)

The `preview` profile in [eas.json](./eas.json) builds an **APK**
(`android.buildType: "apk"`, `distribution: "internal"`) that installs directly on
any Android phone — no Google Play, no manual signing.

```bash
cd mobile
eas build --profile preview --platform android
```

1. Prompt *"Generate a new Android Keystore?"* → **Y** (EAS creates & stores the signing key; no Google developer account needed).
2. ~15–25 min in the cloud. EAS prints a **download URL + QR code**.
3. On the phone: open the URL in **Chrome** → download `ticketly.apk` → tap install → allow **"Install unknown apps"** for Chrome → open **Ticketly**.

### iOS — the important differences

iOS apps **must be code-signed by Apple**; there is no APK-equivalent you can
sideload. You need Apple credentials, and what's possible depends on your account:

| Goal | Apple account required | Command |
| --- | --- | --- |
| Dev build on **your own** device | Free Apple ID (limits) *or* paid | `eas build --profile development --platform ios` |
| **Internal / ad-hoc** `.ipa` for testers | **Apple Developer Program ($99/yr)** + each device UDID | `eas build --profile preview --platform ios` |
| **TestFlight** beta | Apple Developer Program ($99/yr) | `eas build --profile production --platform ios` → `eas submit -p ios` |
| **App Store** release | Apple Developer Program ($99/yr) | `eas submit -p ios --latest` (after a production build) |

- A **free Apple ID** can sign development builds for your own device only, with
  tight limits (7-day expiry, app count cap). **All distribution paths** — ad-hoc
  to other devices, TestFlight, App Store — require a **paid Apple Developer
  Program** ($99/yr).
- On the first iOS build, EAS guides Apple credential setup (sign in with your
  Apple ID, or supply a distribution cert + provisioning profile). For paid
  accounts EAS can manage credentials automatically.
- **Ad-hoc/internal** requires registering each tester device's **UDID** (EAS
  collects it). Install the resulting `.ipa` via Xcode (Window → Devices and
  Simulators), Apple Configurator, or a link service like [Diawi](https://www.diawi.com).
- Apple's rules shift — confirm current requirements in the
  [Expo Apple signing docs](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/).

### Build-time environment variables (critical)

`EXPO_PUBLIC_*` variables are **inlined at build time**, not read at runtime:

- `mobile/.env` is **gitignored and not uploaded by EAS** → it powers **local dev
  only** (`npm run dev:mobile`, Metro, simulator).
- For **release builds**, these live on the **EAS dashboard** (project →
  Environment variables), scoped to `production` + `preview`. Change them there —
  don't commit values to `eas.json` or rely on `.env` for builds. Verify with:
  ```bash
  eas env:list --environment preview --format long
  ```
- Keep **secrets** (auth tokens, API keys) as EAS **secret** variables, never in git.

### Sentry

- **Runtime crash capture** needs only `EXPO_PUBLIC_SENTRY_DSN` (used by
  `Sentry.init` in [src/lib/sentry.ts](./src/lib/sentry.ts)) — already wired, no extra setup.
- **Source-map upload** (the `@sentry/react-native/expo` plugin) is **gated on
  `SENTRY_AUTH_TOKEN`** in [app.config.ts](./app.config.ts). With no token (current
  state) the plugin is skipped, so the build succeeds; crash traces just aren't
  de-obfuscated. To enable source maps later, set `SENTRY_AUTH_TOKEN` /
  `SENTRY_ORG` / `SENTRY_PROJECT` as EAS secrets.

### Over-the-air (OTA) updates

`expo-updates` is enabled with a `fingerprint` runtime version. Push a JS-only
update (no new binary) with `eas update --branch <channel>` (e.g. `preview`). A
binary rebuild is still required for any native-layer or dependency change.

### Gotchas (lessons learned)

- **Run EAS from `mobile/`, not the repo root** — see the callout above.
- **`projectId` placeholder** — `app.config.ts` derives `extra.eas.projectId` and
  `updates.url` from `app.json`. If `eas init` errors `Invalid UUID appId`, a
  `REPLACE_WITH_PROJECT_ID` placeholder has leaked back in; restore the real UUID
  in `app.json` (`expo.extra.eas.projectId`).
- **Expo Go won't load this app** — Skia isn't in Expo Go. Use an EAS build.

## Auth

React Native has no browser cookie jar, so auth uses `@better-auth/expo`: the
Better Auth session cookie is stored in `expo-secure-store` (Keychain /
Encrypted SharedPreferences) and attached as a `Cookie` header on every request
via an axios interceptor (`src/lib/api.ts`). The backend enables this with the
`expo()` plugin + the `ticketly://` scheme in `trustedOrigins`
(`api/src/auth/auth.config.ts`); the web's cookie flow is unchanged.

## Status

**M0 — foundations + auth** and **M1 — tickets** (full list + detail: search,
server sort/filter/paginate, role-aware statuses, conversation thread, optimistic
reply, AI polish + summarize, inline property edits, Activity tab, realtime SSE)
are done. Detailed progress (what's built, decisions, and M2–M4 sub-tasks) lives
in [PROGRESS.md](./PROGRESS.md); the milestone view is in
[implementation-plan.md](../implementation-plan.md); conventions are in the root
[CLAUDE.md](../CLAUDE.md).

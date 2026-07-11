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

## Auth

React Native has no browser cookie jar, so auth uses `@better-auth/expo`: the
Better Auth session cookie is stored in `expo-secure-store` (Keychain /
Encrypted SharedPreferences) and attached as a `Cookie` header on every request
via an axios interceptor (`src/lib/api.ts`). The backend enables this with the
`expo()` plugin + the `ticketly://` scheme in `trustedOrigins`
(`api/src/auth/auth.config.ts`); the web's cookie flow is unchanged.

## Status

**M0 — foundations + auth** is done (login, authed tab shell, tickets list +
detail smoke-test, realtime SSE hook). Feature work is phased in
[implementation-plan.md](../implementation-plan.md); full conventions are in the
root [CLAUDE.md](../CLAUDE.md).

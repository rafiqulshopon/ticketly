import * as Sentry from "@sentry/react-native";

// Errors only — no performance tracing, no session replays, no release pin.
// Mirrors web/src/main.tsx + api/src/instrument.ts. With the DSN unset (local
// dev), `enabled` is false and the SDK makes no outbound calls — a pure no-op.
// Imported as the FIRST module in app/_layout.tsx so it runs before any
// component can throw (the same first-import position api/src/instrument.ts
// holds in the backend's main.ts).
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? "development" : "production",
});

import "dotenv/config"; // FIRST — must run before AppModule imports auth.config.ts
// (which builds a Better Auth PrismaClient at import time and needs DATABASE_URL)
// AND before Sentry reads SENTRY_DSN below.
import * as Sentry from "@sentry/nestjs";

/**
 * Sentry initialization for the API. Imported as the very first module in
 * `main.ts` so it loads before any app module. Errors only — no performance
 * tracing or session replay.
 *
 * With `SENTRY_DSN` unset (local dev), `enabled` is false and the SDK makes no
 * outbound calls — it's a pure no-op, so the app runs identically with or
 * without Sentry configured.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
});

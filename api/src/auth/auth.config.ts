import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Better Auth instance — email/password + admin (roles) plugin, Prisma-backed.
 * Sessions are stored in the DB (Session table) — Better Auth's default when a
 * database adapter is present and no secondaryStorage/cookieCache is configured.
 *
 * The HTTP handler is mounted by `@thallesp/nestjs-better-auth` in app.module.ts
 * (AuthModule.forRoot) at /api/auth/*, with a global session guard.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Fail fast if production isn't served over https: a non-secure BETTER_AUTH_URL
// disables the `Secure` flag on session cookies (Better Auth derives it from the
// scheme), so the cookie could be sent over plain HTTP and intercepted. Dev (http)
// is fine.
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
if (process.env.NODE_ENV === "production" && !baseURL.startsWith("https://")) {
  throw new Error(
    `auth.config: BETTER_AUTH_URL must be https:// in production (got "${baseURL}"). ` +
      "A non-secure URL disables the Secure flag on session cookies.",
  );
}

export const auth = betterAuth({
  baseURL,
  basePath: "/api/auth",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Registration is closed. Accounts are provisioned by the seed (auth.api.createUser,
  // which bypasses this route) or by an admin — not self-service. disableSignUp blocks
  // only POST /api/auth/sign-up/email; sign-in and all other routes still work.
  emailAndPassword: { enabled: true, disableSignUp: true },
  // Required for Better Auth's origin/CSRF check (separate from the CORS
  // headers applied in main.ts). Mirrors the CORS origin allowlist, plus the
  // mobile app's deep-link scheme so the @better-auth/expo client (React
  // Native) passes the origin check. In dev, Expo uses exp:// with the host's
  // LAN IP — trust those wildcards locally only.
  trustedOrigins: [
    ...(process.env.WEB_ORIGIN ?? "http://localhost:5173").split(","),
    "ticketly://",
    ...(process.env.NODE_ENV === "development" ? ["exp://", "exp://**"] : []),
  ],
  // Rate limiting — temporarily disabled. To re-enable, un-comment the block below.
  // Better Auth enables this in production only by default; we force it on so
  // dev/staging are protected too (in-memory store resets on restart, so dev friction
  // is minimal). The default rule is 100 req / 10s; sign-in is tightened via
  // customRules to throttle brute-force / credential-stuffing of the known bootstrap
  // admin email — 5 attempts / 15 min per client IP (override per env as needed).
  // rateLimit: {
  //   enabled: true,
  //   customRules: {
  //     "/sign-in/email": { window: 900, max: 5 },
  //   },
  // },
  // defaultRole "agent" aligns with the Role enum; admins are set via seed/createUser.
  // expo() enables the @better-auth/expo React Native client: it lets the mobile
  // app persist the session cookie in SecureStore and attach it as a Cookie header
  // to API + SSE requests (RN has no browser cookie jar). Web is unaffected —
  // cookies still work alongside this. Reuses the existing DB Session table.
  plugins: [admin({ defaultRole: "agent" }), expo()],
});

export type Auth = typeof auth;

import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
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

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  basePath: "/api/auth",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  // Required for Better Auth's origin/CSRF check (separate from the CORS
  // headers applied in main.ts). Mirrors the CORS origin allowlist.
  trustedOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:5173").split(","),
  plugins: [admin()],
});

export type Auth = typeof auth;

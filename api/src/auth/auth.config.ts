import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Better Auth instance — email/password + admin (roles) plugin, Prisma-backed.
 *
 * NOTE (Phase 0): the HTTP handler is intentionally NOT mounted yet.
 * Phase 1 wires it via `@thallesp/nestjs-better-auth` (or a catch-all controller
 * delegating to `auth.handler`) at /api/auth/*, plus a session guard.
 * See implementation-plan.md → Phase 1.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  basePath: "/api/auth",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  plugins: [admin()],
});

export type Auth = typeof auth;

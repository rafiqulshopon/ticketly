import "dotenv/config";
import { randomUUID } from "node:crypto";
import { auth, prisma } from "../src/auth/auth.config";
import { Role } from "../src/generated/prisma/client";
import { SYSTEM_AGENT_EMAIL } from "../src/tickets/tickets.constants";

/**
 * Seeds a bootstrap admin from env (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
 * Run from the api/ directory:  npm run db:seed
 *
 * Uses the admin plugin's `createUser` (server-side, no session required, sets
 * the role) and checks existence via Prisma directly.
 */
async function main() {
  await seedAiAgent();

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("Seed: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin.");
    return;
  }

  // Refuse to provision an admin with a weak/placeholder password. The bootstrap
  // admin email is a known target (see sign-in rate limiting in auth.config.ts);
  // blocking the known example defaults here closes the "operator forgets to
  // rotate" gap. The 8-char floor matches the app-wide minimum (the shared
  // `passwordRule` and Better Auth's own policy both enforce ≥8).
  const KNOWN_DEFAULTS = ["change-me-please", "changeme", "password", "admin"];
  if (KNOWN_DEFAULTS.includes(password) || password.length < 8) {
    throw new Error(
      "Seed: SEED_ADMIN_PASSWORD is too weak — use ≥8 characters and not a known " +
        "default. Set a strong value before running `npm run db:seed`.",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed: user '${email}' already exists — skipping.`);
    return;
  }

  await auth.api.createUser({
    body: { email, password, name: "Admin", role: Role.admin },
  });
  console.log(`Seed: created admin '${email}'.`);
}

/**
 * Ensure the system "AI" agent exists — a bare `User` (no login credentials) that
 * new tickets are assigned to and whose replies are attributed to it. Idempotent
 * (upsert by email) and unconditional, unlike the admin which needs env vars.
 * The `update` keeps the display name in sync on re-runs.
 */
async function seedAiAgent() {
  const user = await prisma.user.upsert({
    where: { email: SYSTEM_AGENT_EMAIL },
    update: { name: "AI Agent" },
    create: { id: randomUUID(), email: SYSTEM_AGENT_EMAIL, name: "AI Agent", role: Role.agent },
  });
  console.log(`Seed: ensured AI agent '${SYSTEM_AGENT_EMAIL}' (id ${user.id}).`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

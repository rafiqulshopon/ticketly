import "dotenv/config";
import { auth, prisma } from "../src/auth/auth.config";
import { Role } from "../src/generated/prisma/client";

/**
 * Seeds a bootstrap admin from env (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
 * Run from the api/ directory:  npm run db:seed
 *
 * Uses the admin plugin's `createUser` (server-side, no session required, sets
 * the role) and checks existence via Prisma directly.
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("Seed: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping.");
    return;
  }

  // Refuse to provision an admin with a weak/placeholder password. The bootstrap
  // admin email is a known target (see sign-in rate limiting in auth.config.ts);
  // forcing a strong password here closes the "operator forgets to rotate" gap.
  // (Better Auth's own policy only enforces ≥8 chars, which lets the example
  // default through — so we check explicitly.)
  const KNOWN_DEFAULTS = ["change-me-please", "changeme", "password", "admin"];
  if (KNOWN_DEFAULTS.includes(password) || password.length < 12) {
    throw new Error(
      "Seed: SEED_ADMIN_PASSWORD is too weak — use ≥12 characters and not a known " +
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

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

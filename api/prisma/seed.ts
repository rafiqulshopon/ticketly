import "dotenv/config";
import { auth, prisma } from "../src/auth/auth.config";

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed: user '${email}' already exists — skipping.`);
    return;
  }

  await auth.api.createUser({
    body: { email, password, name: "Admin", role: "admin" },
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

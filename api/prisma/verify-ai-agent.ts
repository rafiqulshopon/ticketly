import "dotenv/config";
import { prisma } from "../src/auth/auth.config";
import { SYSTEM_AGENT_EMAIL } from "../src/tickets/tickets.constants";

async function main() {
  const ai = await prisma.user.findUnique({
    where: { email: SYSTEM_AGENT_EMAIL },
    select: { id: true, email: true, name: true, role: true, accounts: { select: { id: true } } },
  });
  console.log("AI agent row:", ai ? JSON.stringify(ai) : "NOT FOUND");

  // Mirror the listAssignees exclusion: AI agent should NOT appear among assignees.
  const assignees = await prisma.user.findMany({
    where: { deletedAt: null, email: { not: SYSTEM_AGENT_EMAIL } },
    select: { email: true },
  });
  console.log(
    "AI agent hidden from assignees list?",
    !assignees.some((u) => u.email === SYSTEM_AGENT_EMAIL),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().then(() => process.exit(0)));

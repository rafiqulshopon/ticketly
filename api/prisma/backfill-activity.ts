import "dotenv/config";
import { prisma } from "../src/auth/auth.config";
import type { TicketActivityType } from "../src/generated/prisma/client";
import { SYSTEM_AGENT_EMAIL } from "../src/tickets/tickets.constants";

/**
 * One-off, idempotent backfill of the activity timeline for tickets that predate
 * the feature. Run from the api/ directory:  npm run db:backfill-activity
 *
 * For each ticket with NO activity rows yet, reconstructs what's recoverable from
 * existing data:
 *   - a `ticket_created` entry at the ticket's `createdAt`;
 *   - one reply entry per existing Message (customer_replied / agent_replied /
 *     ai_replied) at the message's `createdAt`, using the same AI detection as
 *     `TicketsService.loadTicketDetail`.
 *
 * NOT recoverable (no history was ever stored): past status / priority /
 * category / assignee changes. Only creation + replies are reconstructed.
 *
 * Idempotent: a ticket with any existing activity row is skipped, so re-running
 * only backfills tickets created since the previous run. Inserts only — no
 * destructive changes, so it's safe to run more than once.
 */
async function main() {
  const ai = await prisma.user.findUnique({
    where: { email: SYSTEM_AGENT_EMAIL },
    select: { id: true },
  });
  const aiAgentId = ai?.id ?? null;

  const tickets = await prisma.ticket.findMany({
    select: {
      id: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, senderType: true, senderId: true, sender: { select: { name: true } } },
      },
    },
  });

  let backfilled = 0;
  let skipped = 0;
  let rows = 0;

  for (const t of tickets) {
    // Idempotency guard: never re-backfill a ticket that already has activity.
    const existing = await prisma.ticketActivity.count({ where: { ticketId: t.id } });
    if (existing > 0) {
      skipped++;
      continue;
    }

    const data: Array<{
      ticketId: number;
      type: TicketActivityType;
      actorUserId: string | null;
      actorName: string | null;
      createdAt: Date;
    }> = [];

    data.push({ ticketId: t.id, type: "ticket_created", actorUserId: null, actorName: null, createdAt: t.createdAt });

    for (const m of t.messages) {
      const isAi = (aiAgentId !== null && m.senderId === aiAgentId) || (m.senderType === "agent" && !m.senderId);
      const type: TicketActivityType =
        m.senderType === "customer" ? "customer_replied" : isAi ? "ai_replied" : "agent_replied";
      data.push({
        ticketId: t.id,
        type,
        // Only staff/AI messages have a sender; customer replies have no actor.
        actorUserId: m.senderType === "agent" ? m.senderId : null,
        actorName: m.sender?.name ?? null,
        createdAt: m.createdAt,
      });
    }

    await prisma.ticketActivity.createMany({ data });
    backfilled++;
    rows += data.length;
  }

  console.log(
    `Backfill complete: ${backfilled} ticket(s) backfilled, ${rows} activity row(s) written, ${skipped} skipped (already had activity).`,
  );
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

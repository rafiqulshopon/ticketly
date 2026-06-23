import { Injectable } from "@nestjs/common";
import type { CreateTicketInput, Ticket } from "@ticketly/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Placeholder destination for the first inbound message on a ticket. There is no
 * real support address yet; when a real email provider is wired this becomes the
 * configured inbound address the requester mailed. It only fills the required
 * `Message.toEmail` column.
 */
const SUPPORT_INBOUND_ADDRESS = "support@ticketly.local";

/**
 * Ticket creation — the single write path used by both:
 *  - the manual `POST /tickets` endpoint (staff logging a request, no messageId)
 *  - the inbound-email webhook (`POST /channels/email/inbound`, with a messageId)
 *
 * When `opts.messageId` is provided the create is idempotent: a ticket already
 * saved under that RFC822 Message-ID is returned untouched (`created: false`),
 * and a retry race that trips the `messageId` unique constraint is reconciled by
 * re-reading the winner. The Ticket and its first inbound Message are written in
 * one transaction so neither row can exist without the other.
 */
@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateTicketInput,
    opts: { messageId?: string | null } = {},
  ): Promise<{ ticket: Ticket; created: boolean }> {
    const messageId = opts.messageId ?? null;

    // Fast path: a webhook re-delivery/retry of an already-stored message.
    if (messageId) {
      const existing = await this.prisma.ticket.findUnique({ where: { messageId } });
      if (existing) return { ticket: existing, created: false };
    }

    try {
      const ticket = await this.prisma.$transaction(async (tx) => {
        const created = await tx.ticket.create({
          data: {
            subject: input.subject,
            requesterEmail: input.requesterEmail,
            requesterName: input.requesterName,
            // status/priority use the schema defaults (OPEN / NORMAL). category has
            // no default — store null when omitted (assigned later by AI classify).
            category: input.category ?? null,
            messageId,
          },
        });

        await tx.message.create({
          data: {
            ticketId: created.id,
            direction: "inbound",
            fromEmail: input.requesterEmail,
            toEmail: SUPPORT_INBOUND_ADDRESS,
            subject: input.subject,
            bodyText: input.bodyText,
            bodyHtml: input.bodyHtml ?? null,
            messageId,
            // inReplyTo stays null until reply threading is implemented.
          },
        });

        return created;
      });
      return { ticket, created: true };
    } catch (err) {
      // P2002 (unique violation) on messageId under a concurrent retry race:
      // another worker won — return its ticket instead of erroring.
      if (messageId && isUniqueViolation(err)) {
        const existing = await this.prisma.ticket.findUnique({ where: { messageId } });
        if (existing) return { ticket: existing, created: false };
      }
      throw err;
    }
  }
}

/** Duck-typed Prisma unique-constraint check (code P2002), avoiding a client import. */
function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2002";
}

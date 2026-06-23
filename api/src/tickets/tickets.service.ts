import { Injectable } from "@nestjs/common";
import type {
  CreateTicketInput,
  ListTicketsQuery,
  Ticket,
  TicketListItem,
  TicketListResponse,
} from "@ticketly/shared";
import type { Ticket as TicketRow } from "../generated/prisma/client";
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

  /**
   * Ticket list, server-sorted by the requested column (default `createdAt`
   * DESC = newest first). `q` is a case-insensitive substring match on subject
   * or requester email; status/category/priority/assigneeId are optional
   * equality filters (wired into the UI later). All staff see all tickets here
   * — no assignee scoping (shared inbox).
   */
  async list(opts: ListTicketsQuery): Promise<TicketListResponse> {
    const { q, status, category, priority, assigneeId, sortBy, sortDir, page, pageSize } = opts;
    const where = {
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: "insensitive" as const } },
              { requesterEmail: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(priority ? { priority } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    };

    // Closed whitelist: only the four allowed columns reach Prisma's orderBy —
    // never an arbitrary key from the query string. Each branch is a valid Prisma
    // orderBy literal, so indexing by the enum-typed `sortBy` is fully type-safe.
    const orderBy = {
      createdAt: { createdAt: sortDir },
      subject: { subject: sortDir },
      requesterName: { requesterName: sortDir },
      status: { status: sortDir },
    }[sortBy];

    const [rows, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return { items: rows.map((t) => this.toListItem(t)), total, page, pageSize };
  }

  /** Map a Prisma `Ticket` row to the wire shape (timestamps → ISO strings). */
  private toListItem(t: TicketRow): TicketListItem {
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      category: t.category,
      priority: t.priority,
      requesterEmail: t.requesterEmail,
      requesterName: t.requesterName,
      assigneeId: t.assigneeId,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}

/** Duck-typed Prisma unique-constraint check (code P2002), avoiding a client import. */
function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2002";
}

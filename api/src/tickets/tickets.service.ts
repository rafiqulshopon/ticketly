import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AssigneeOption,
  CreateReplyInput,
  CreateTicketInput,
  ListTicketsQuery,
  PolishReplyInput,
  PolishReplyResult,
  Ticket,
  TicketDetail,
  TicketListItem,
  TicketListResponse,
  UpdateTicketInput,
} from "@ticketly/shared";
import type { Ticket as TicketRow } from "../generated/prisma/client";
import { AiService } from "../ai/ai.service";
import { sanitizeEmailHtml } from "../common/sanitize-html";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

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
            senderType: "customer",
            fromEmail: input.requesterEmail,
            toEmail: SUPPORT_INBOUND_ADDRESS,
            subject: input.subject,
            bodyText: input.bodyText,
            // bodyHtml is sanitized here — the only write path for it — so the
            // DB never stores untrusted email HTML verbatim.
            bodyHtml: sanitizeEmailHtml(input.bodyHtml),
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

  /**
   * Single ticket by id. Resolves the assignee relation into name/email for
   * human-readable display and includes the conversation `messages` (oldest
   * first), each with its staff `sender` name resolved. Unscoped (shared inbox):
   * all staff see all tickets, matching list(). Throws NotFoundException (404)
   * when the id doesn't exist.
   */
  async findOne(id: number): Promise<TicketDetail> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: { select: { name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { name: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      category: ticket.category,
      priority: ticket.priority,
      requesterEmail: ticket.requesterEmail,
      requesterName: ticket.requesterName,
      assigneeId: ticket.assigneeId,
      assigneeName: ticket.assignee ? ticket.assignee.name : null,
      assigneeEmail: ticket.assignee ? ticket.assignee.email : null,
      // `direction` is a plain String column; the create path only ever writes
      // "inbound" | "outbound", so the cast is sound.
      messages: ticket.messages.map((m) => ({
        id: m.id,
        direction: m.direction as "inbound" | "outbound",
        senderType: m.senderType,
        fromEmail: m.fromEmail,
        toEmail: m.toEmail,
        senderName: m.sender ? m.sender.name : null,
        bodyText: m.bodyText,
        createdAt: m.createdAt.toISOString(),
      })),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  /**
   * Reply to a ticket — appends an outbound `Message` authored by the signed-in
   * staff agent (`senderId`), addressed to the requester. The email envelope is
   * derived from the ticket (from = the support address, to = requester, subject
   * = "Re: <subject>", inReplyTo = the originating inbound Message-ID when the
   * ticket came from email). `bodyHtml` is intentionally null — there is no
   * rich-text composer and the detail view never trusts composed HTML.
   *
   * Replying to an OPEN ticket also flips it to AWAITING_STUDENT (the agent has
   * replied, now waiting on the requester); RESOLVED/CLOSED tickets are left
   * untouched — no silent reopen. Both writes happen in one transaction.
   *
   * There is no outbound mail provider wired yet, so nothing is actually emailed
   * — the reply lives in-thread only (visible via findOne). Throws
   * NotFoundException (404) for an unknown ticket. Unscoped (shared inbox),
   * matching list()/findOne().
   */
  async reply(ticketId: number, input: CreateReplyInput, senderId: string): Promise<TicketDetail> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, subject: true, requesterEmail: true, messageId: true },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");

    const nextStatus = ticket.status === "OPEN" ? "AWAITING_STUDENT" : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          ticketId: ticket.id,
          direction: "outbound",
          senderType: "agent",
          fromEmail: SUPPORT_INBOUND_ADDRESS,
          toEmail: ticket.requesterEmail,
          subject: `Re: ${ticket.subject}`,
          bodyText: input.bodyText,
          bodyHtml: null,
          senderId,
          inReplyTo: ticket.messageId ?? null,
        },
      });
      if (nextStatus) {
        await tx.ticket.update({ where: { id: ticket.id }, data: { status: nextStatus } });
      }
    });

    return this.findOne(ticketId);
  }

  /**
   * AI-polish a drafted reply, using the ticket's conversation as context.
   * Read-only — persists nothing and sends no mail; it returns the improved body
   * for the agent to review and edit before sending. The returned body is signed
   * with the agent's name and the product name (Ticketly). Reuses `findOne` for
   * both the 404 check and the conversation context (subject + messages). A
   * model/provider failure surfaces as a 502 Bad Gateway so the client can tell an
   * AI outage apart from an app error. Throws NotFoundException (404) for an
   * unknown ticket.
   */
  async polish(id: number, input: PolishReplyInput, agentName: string): Promise<PolishReplyResult> {
    const ticket = await this.findOne(id);
    let bodyText: string;
    try {
      bodyText = await this.ai.polishReply(input.bodyText, ticket, agentName);
    } catch {
      throw new BadGatewayException("Polish service is unavailable");
    }
    if (!bodyText) throw new BadGatewayException("Polish service returned no content");
    return { bodyText };
  }

  /**
   * Update a ticket. Today only `assigneeId` is supported: set it to a staff
   * user id, or `null` to unassign. The assignee is validated (exists and not
   * soft-deleted) before writing; there's no separate role check since only
   * `admin`/`agent` users exist. Returns the fresh detail via `findOne`.
   * Throws NotFoundException (404) for an unknown ticket, BadRequestException
   * (400) for an invalid assignee. Unscoped (shared inbox), matching list().
   */
  async update(id: number, input: UpdateTicketInput): Promise<TicketDetail> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, select: { id: true } });
    if (!ticket) throw new NotFoundException("Ticket not found");

    if (input.assigneeId !== undefined && input.assigneeId !== null) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: input.assigneeId },
        select: { deletedAt: true },
      });
      if (!assignee || assignee.deletedAt) {
        throw new BadRequestException("Invalid assignee");
      }
    }

    // Partial update — only the fields the client sent. `undefined` = leave
    // unchanged; `null` = clear (unassign / uncategory). Mirrors the conditional
    // spread used to build `where` in list(); invalid enum values were already
    // rejected by the Zod parse in the controller.
    const data = {
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
    };

    await this.prisma.ticket.update({ where: { id }, data });
    return this.findOne(id);
  }

  /**
   * Staff available for assignment (non-deleted users, name-sorted). Minimal
   * projection — only id/name/role — so the staff-wide assignee endpoint doesn't
   * expose the admin directory's email/account fields.
   */
  async listAssignees(): Promise<AssigneeOption[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      // Prisma `Role` is a string-literal union identical to the shared
      // `userRoleEnum` (`AssigneeOption.role`), so no cast is needed.
      role: u.role,
    }));
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

import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
  AssigneeOption,
  CreateReplyInput,
  CreateTicketInput,
  ListTicketsQuery,
  PolishReplyInput,
  PolishReplyResult,
  SummarizeTicketResult,
  Ticket,
  TicketDetail,
  TicketListItem,
  TicketListResponse,
  UpdateTicketInput,
} from "@ticketly/shared";
import type { Ticket as TicketRow, TicketStatus } from "../generated/prisma/client";
import { AiService } from "../ai/ai.service";
import { sanitizeEmailHtml } from "../common/sanitize-html";
import { PrismaService } from "../prisma/prisma.service";
import { SystemAgentService } from "../system-agent/system-agent.service";
import {
  AUTO_RESOLVE_TICKET_QUEUE,
  AUTO_RESOLVE_TICKET_SEND_OPTIONS,
  type AutoResolveTicketJobData,
  CLASSIFY_TICKET_QUEUE,
  CLASSIFY_TICKET_SEND_OPTIONS,
  type ClassifyTicketJobData,
} from "../queue/queue.constants";
import { QueueService } from "../queue/queue.service";
import { SYSTEM_AGENT_EMAIL } from "./tickets.constants";

/**
 * Placeholder destination for the first inbound message on a ticket. There is no
 * real support address yet; when a real email provider is wired this becomes the
 * configured inbound address the requester mailed. It only fills the required
 * `Message.toEmail` column (and the `fromEmail` of outbound replies, including
 * AI auto-resolve replies).
 */
export const SUPPORT_INBOUND_ADDRESS = "support@ticketly.local";

/** Statuses the AI auto-resolution pipeline owns (NEW = just arrived,
 *  PROCESSING = AI is attempting to resolve). Hidden from the default ticket
 *  list so the inbox shows only tickets that need a human; an explicit status
 *  filter selection is always honored over this default exclusion. */
const HIDDEN_FROM_DEFAULT_LIST: TicketStatus[] = ["NEW", "PROCESSING"];

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
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly queue: QueueService,
    private readonly systemAgent: SystemAgentService,
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

    // Assign to the AI system agent while the auto-resolver works the ticket. Null
    // (unassigned) if it isn't seeded yet — never block ticket creation on this.
    const aiAgentId = await this.systemAgent.getAiAgentId();

    try {
      const ticket = await this.prisma.$transaction(async (tx) => {
        const created = await tx.ticket.create({
          data: {
            subject: input.subject,
            requesterEmail: input.requesterEmail,
            requesterName: input.requesterName,
            // status/priority use the schema defaults (NEW / NORMAL). category has
            // no default — store null when omitted (assigned later by AI classify).
            category: input.category ?? null,
            assigneeId: aiAgentId,
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

      // Enqueue a durable classify job (pg-boss) when no explicit category was
      // provided — an explicit one is respected, never overwritten. Enqueueing is
      // a fast DB insert, so the LLM latency (seconds) still never blocks the
      // create response. A queue hiccup is caught and logged so it can never fail
      // ticket creation; worst case the ticket is left to be classified later.
      if (input.category == null) {
        try {
          await this.queue.send<ClassifyTicketJobData>(
            CLASSIFY_TICKET_QUEUE,
            { ticketId: ticket.id, subject: input.subject, body: input.bodyText },
            CLASSIFY_TICKET_SEND_OPTIONS,
          );
        } catch (err) {
          this.logger.warn(
            `Classify: enqueue failed for ticket ${ticket.id}, leaving it uncategorized — ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      // Enqueue a durable auto-resolve job for every new ticket. The consumer
      // drives NEW → PROCESSING → (RESOLVED | OPEN) using the knowledge base.
      // Same fast-DB-insert posture as classify: the LLM latency never blocks the
      // create response. If the enqueue itself fails (rare — it's the same DB the
      // ticket was just written to), fall the ticket back to OPEN so it's never
      // stranded invisible in NEW waiting for a job that was never queued.
      try {
        await this.queue.send<AutoResolveTicketJobData>(
          AUTO_RESOLVE_TICKET_QUEUE,
          { ticketId: ticket.id },
          AUTO_RESOLVE_TICKET_SEND_OPTIONS,
        );
      } catch (err) {
        this.logger.warn(
          `Auto-resolve: enqueue failed for ticket ${ticket.id}, moving it to OPEN — ${err instanceof Error ? err.message : err}`,
        );
        try {
          await this.prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: "OPEN", assigneeId: null },
          });
        } catch (reopenErr) {
          this.logger.error(
            `Auto-resolve: could not move ticket ${ticket.id} to OPEN after enqueue failure — ${reopenErr instanceof Error ? reopenErr.message : reopenErr}`,
          );
        }
      }

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
      // No explicit status filter → hide the AI auto-resolution pipeline states
      // (NEW / PROCESSING) so the inbox only shows tickets that need a human. An
      // explicit status selection — incl. New/Processing for oversight — is
      // always honored over this default exclusion.
      ...(status ? { status } : { status: { notIn: HIDDEN_FROM_DEFAULT_LIST } }),
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
    const aiAgentId = await this.systemAgent.getAiAgentId();
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
        // Authored by the system AI agent — either attributed now (senderId === the
        // AI user) or a legacy reply from before attribution (agent msg, no sender).
        isAi:
          (aiAgentId !== null && m.senderId === aiAgentId) ||
          (m.senderType === "agent" && m.senderId === null),
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
   * AI-summarize a ticket and its conversation. Read-only — persists nothing; it
   * returns a plain-text digest for the agent. The summary is generated fresh on
   * every call (no caching), so the client "regenerates" simply by calling again.
   * Reuses `findOne` for both the 404 check and the conversation context. A
   * model/provider failure surfaces as a 502 Bad Gateway so the client can tell an
   * AI outage apart from an app error. Throws NotFoundException (404) for an
   * unknown ticket.
   */
  async summarize(id: number): Promise<SummarizeTicketResult> {
    const ticket = await this.findOne(id);
    let summary: string;
    try {
      summary = await this.ai.summarizeTicket(ticket);
    } catch {
      throw new BadGatewayException("Summarize service is unavailable");
    }
    if (!summary) throw new BadGatewayException("Summarize service returned no content");
    return { summary };
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
      // Stamp the resolution time when a ticket is first resolved/closed, powering
      // the dashboard's average-resolution-time metric (null until then).
      ...(input.status === "RESOLVED" || input.status === "CLOSED" ? { resolvedAt: new Date() } : {}),
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
      // Exclude the AI system agent — humans shouldn't manually assign to it.
      where: { deletedAt: null, email: { not: SYSTEM_AGENT_EMAIL } },
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
